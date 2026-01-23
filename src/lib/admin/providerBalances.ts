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
 * Fetch fresh provider balances from APIs (always returns Kie + Fal)
 */
export async function fetchProviderBalances(): Promise<{
  success: boolean;
  balances?: ProviderBalance[];
  fetched_at?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-provider-balances');

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const balances = Array.isArray(data?.balances) ? data.balances : [];
    const fetchedAt = data?.fetched_at || new Date().toISOString();

    const normalized = balances.map((b: Partial<ProviderBalance> & { error?: string }) => {
      const v = Number(b.balance_value);
      return {
        provider: b.provider! as 'kie' | 'fal',
        balance_value: Number.isFinite(v) ? v : 0,
        balance_unit: b.balance_unit ?? 'credits',
        fetched_at: b.fetched_at ?? fetchedAt,
        error_message: b.error_message ?? b.error ?? undefined,
      };
    });

    return { success: true, balances: normalized, fetched_at: fetchedAt };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch provider balances';
    console.error('Error fetching provider balances:', err);
    return { success: false, error: msg };
  }
}

/**
 * Get all provider balances (Kie + Fal). Uses cache or fetches fresh; always returns both.
 */
export async function getAllProviderBalances(forceRefresh: boolean = false): Promise<ProviderBalance[]> {
  const providers: ('kie' | 'fal')[] = ['kie', 'fal'];
  const cached: Record<string, ProviderBalance | null> = {};
  let freshResult: { success: boolean; balances?: ProviderBalance[]; error?: string } | null = null;

  for (const p of providers) {
    try {
      cached[p] = await getLatestProviderBalance(p);
    } catch {
      cached[p] = null;
    }
  }

  const needRefresh =
    forceRefresh ||
    providers.some((p) => shouldRefreshBalance(cached[p]?.fetched_at ?? null));

  if (needRefresh) {
    freshResult = await fetchProviderBalances();
  }

  const balances: ProviderBalance[] = [];
  for (const provider of providers) {
    if (freshResult?.success && Array.isArray(freshResult.balances)) {
      const b = freshResult.balances.find((x) => x.provider === provider);
      if (b) {
        balances.push(b);
        continue;
      }
    }
    if (cached[provider]) {
      balances.push(cached[provider]!);
    } else {
      balances.push({
        provider,
        balance_value: 0,
        balance_unit: 'credits',
        fetched_at: new Date().toISOString(),
        error_message: freshResult?.error ?? 'No balance data available',
      });
    }
  }

  return balances;
}
