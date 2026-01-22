/**
 * Provider Balance Service
 * Handles fetching and caching provider account balances
 */

import { supabase } from "@/integrations/supabase/client";

export interface ProviderBalance {
  provider: 'kie' | 'fal';
  balance_value: number;
  balance_unit: string;
  fetched_at: string;
  error_message?: string;
}

const CACHE_DURATION_MINUTES = 10; // Default cache duration

/**
 * Get latest provider balance from database
 */
export async function getLatestProviderBalance(
  provider: 'kie' | 'fal'
): Promise<ProviderBalance | null> {
  try {
    const { data, error } = await supabase
      .from('provider_balance_snapshots')
      .select('provider, balance_value, balance_unit, fetched_at, error_message')
      .eq('provider', provider)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error(`Error fetching latest ${provider} balance:`, error);
    return null;
  }
}

/**
 * Check if balance needs refresh (older than cache duration)
 */
export function shouldRefreshBalance(fetchedAt: string | null, cacheMinutes: number = CACHE_DURATION_MINUTES): boolean {
  if (!fetchedAt) return true;
  
  const fetchedTime = new Date(fetchedAt).getTime();
  const now = Date.now();
  const cacheDurationMs = cacheMinutes * 60 * 1000;
  
  return (now - fetchedTime) > cacheDurationMs;
}

/**
 * Fetch fresh provider balances from APIs
 */
export async function fetchProviderBalances(): Promise<{ success: boolean; balances?: ProviderBalance[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-provider-balances');

    if (error) throw error;

    return {
      success: true,
      balances: data.balances,
    };
  } catch (error: any) {
    console.error('Error fetching provider balances:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch provider balances',
    };
  }
}

/**
 * Get all provider balances (with refresh logic)
 */
export async function getAllProviderBalances(forceRefresh: boolean = false): Promise<ProviderBalance[]> {
  const providers: ('kie' | 'fal')[] = ['kie', 'fal'];
  const balances: ProviderBalance[] = [];

  for (const provider of providers) {
    const latest = await getLatestProviderBalance(provider);
    
    // Refresh if forced or cache expired
    if (forceRefresh || shouldRefreshBalance(latest?.fetched_at || null)) {
      // Fetch fresh balance
      const freshResult = await fetchProviderBalances();
      
      if (freshResult.success && freshResult.balances) {
        const providerBalance = freshResult.balances.find(b => b.provider === provider);
        if (providerBalance) {
          balances.push(providerBalance);
          continue;
        }
      }
    }

    // Use cached balance if available
    if (latest) {
      balances.push(latest);
    } else {
      // No balance found, return placeholder
      balances.push({
        provider,
        balance_value: 0,
        balance_unit: 'credits',
        fetched_at: new Date().toISOString(),
        error_message: 'No balance data available',
      });
    }
  }

  return balances;
}
