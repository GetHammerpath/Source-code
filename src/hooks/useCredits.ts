import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CreditBalance {
  credits: number;
  updated_at: string;
}

export function useCredits() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBalance();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('credit_balance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_balance',
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

      setBalance(data || { credits: 0, updated_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      toast({
        title: 'Error',
        description: 'Failed to load credit balance',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkCredits = (required: number): boolean => {
    if (!balance) return false;
    return balance.credits >= required;
  };

  return {
    balance,
    loading,
    refresh: fetchBalance,
    checkCredits,
    hasCredits: (required: number) => checkCredits(required),
  };
}
