import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StudioAccessSubscription {
  id: string;
  user_id: string;
  plan: 'studio_access';
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing';
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export function useStudioAccess() {
  const [subscription, setSubscription] = useState<StudioAccessSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscription();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('subscriptions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error fetching Studio Access subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    loading,
    refresh: fetchSubscription,
    isActive: subscription?.status === 'active' || subscription?.status === 'trialing',
    hasAccess: subscription?.status === 'active' || subscription?.status === 'trialing',
  };
}
