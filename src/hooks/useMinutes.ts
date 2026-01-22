import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MinuteBalance {
  minutes: number; // Displayed as minutes, stored as credits internally
  updated_at: string;
}

export function useMinutes() {
  const [balance, setBalance] = useState<MinuteBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBalance();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('minute_balance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_balance', // Still using credit_balance table internally
        },
        () => {
          fetchBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBalance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBalance(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('credit_balance')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      // Convert credits to minutes (1:1 mapping)
      setBalance(data ? { 
        minutes: data.credits, // 1 credit = 1 minute
        updated_at: data.updated_at 
      } : { minutes: 0, updated_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error fetching minute balance:', error);
      toast({
        title: 'Error',
        description: 'Failed to load minute balance',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkMinutes = (required: number): boolean => {
    if (!balance) return false;
    return balance.minutes >= required;
  };

  return {
    balance,
    loading,
    refresh: fetchBalance,
    checkMinutes,
    hasMinutes: (required: number) => checkMinutes(required),
  };
}
