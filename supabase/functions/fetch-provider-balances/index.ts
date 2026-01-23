import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProviderBalance {
  provider: 'kie' | 'fal';
  balance_value: number;
  balance_unit: string;
  error?: string;
}

async function fetchKieBalance(apiKey: string): Promise<ProviderBalance> {
  try {
    // Try multiple possible Kie.ai API endpoints for balance
    const endpoints = [
      'https://api.kie.ai/api/v1/account/balance',
      'https://api.kie.ai/v1/account/balance',
      'https://api.kie.ai/api/v1/user/balance',
      'https://api.kie.ai/api/v1/account',
    ];

    let lastError: Error | null = null;
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Kie balance response from ${endpoint}:`, JSON.stringify(data));
          
          // Try different response structures
          const balance = data.balance || data.credits || data.credit_balance || data.remaining_credits || data.amount || 0;
          const unit = data.currency || data.unit || 'credits';
          
          return {
            provider: 'kie',
            balance_value: typeof balance === 'number' ? balance : parseFloat(balance) || 0,
            balance_unit: unit,
          };
        }
      } catch (err: any) {
        lastError = err;
        console.log(`Kie endpoint ${endpoint} failed:`, err.message);
        continue;
      }
    }

    // If all endpoints failed, try a simple API call to verify the key works
    const testResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: true }),
    });

    if (testResponse.status === 401 || testResponse.status === 403) {
      throw new Error('Invalid Kie.ai API key');
    }

    throw lastError || new Error('Could not find valid Kie.ai balance endpoint');
  } catch (error: any) {
    console.error('Error fetching Kie balance:', error);
    return {
      provider: 'kie',
      balance_value: 0,
      balance_unit: 'credits',
      error: error.message || 'Failed to fetch Kie balance - API endpoint may not exist',
    };
  }
}

async function fetchFalBalance(apiKey: string): Promise<ProviderBalance> {
  try {
    // fal.ai uses key format: key_id:key_secret
    const [keyId, keySecret] = apiKey.split(':');
    
    if (!keyId || !keySecret) {
      throw new Error('Invalid Fal API key format. Expected: key_id:key_secret');
    }

    // Try multiple possible Fal.ai API endpoints for balance
    const endpoints = [
      'https://fal.run/api/v1/account/balance',
      'https://api.fal.run/v1/account/balance',
      'https://fal.run/api/v1/user/balance',
      'https://fal.run/api/v1/account',
    ];

    let lastError: Error | null = null;
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Key ${apiKey}`, // Fal uses "Key" prefix
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Fal balance response from ${endpoint}:`, JSON.stringify(data));
          
          // Try different response structures
          const balance = data.balance || data.credits || data.credit_balance || data.remaining_credits || data.amount || 0;
          const unit = data.currency || data.unit || 'credits';
          
          return {
            provider: 'fal',
            balance_value: typeof balance === 'number' ? balance : parseFloat(balance) || 0,
            balance_unit: unit,
          };
        }
      } catch (err: any) {
        lastError = err;
        console.log(`Fal endpoint ${endpoint} failed:`, err.message);
        continue;
      }
    }

    throw lastError || new Error('Could not find valid Fal.ai balance endpoint');
  } catch (error: any) {
    console.error('Error fetching fal balance:', error);
    return {
      provider: 'fal',
      balance_value: 0,
      balance_unit: 'credits',
      error: error.message || 'Failed to fetch fal balance - API endpoint may not exist',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Verify user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      throw new Error('Only admins can fetch provider balances');
    }

    // Get API keys from environment
    const kieApiKey = Deno.env.get('KIE_AI_API_TOKEN') || Deno.env.get('KIE_API_KEY');
    const falApiKey = Deno.env.get('FAL_API_KEY');
    
    if (!kieApiKey) {
      console.warn('KIE_AI_API_TOKEN or KIE_API_KEY not set');
    }
    if (!falApiKey) {
      console.warn('FAL_API_KEY not set');
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const timestamp = new Date().toISOString();
    const balances: (ProviderBalance & { fetched_at: string })[] = [];

    // Kie: fetch or placeholder
    let kieBalance: ProviderBalance & { fetched_at: string };
    if (kieApiKey) {
      const b = await fetchKieBalance(kieApiKey);
      kieBalance = { ...b, fetched_at: timestamp };
      try {
        const { error: kieError } = await adminSupabase
          .from('provider_balance_snapshots')
          .insert({
            provider: 'kie',
            balance_value: b.balance_value,
            balance_unit: b.balance_unit,
            fetched_at: timestamp,
            error_message: b.error || null,
            raw_response_json: b.error ? null : { success: true },
          });
        if (kieError) console.error('Error storing Kie balance snapshot:', kieError);
      } catch (e) {
        console.error('Error storing Kie balance snapshot:', e);
      }
      if (!b.error) {
        try {
          await supabase.functions.invoke('admin-audit-log', {
            body: {
              action_type: 'provider_balance_refresh',
              target_type: 'provider',
              target_id: 'kie',
              before_json: {},
              after_json: { balance: b.balance_value, unit: b.balance_unit },
              reason: 'Admin refreshed provider balance',
            },
          });
        } catch (_) {}
      }
    } else {
      kieBalance = {
        provider: 'kie',
        balance_value: 0,
        balance_unit: 'credits',
        error: 'API key not configured (KIE_AI_API_TOKEN or KIE_API_KEY)',
        fetched_at: timestamp,
      };
    }
    balances.push(kieBalance);

    // Fal: fetch or placeholder
    let falBalance: ProviderBalance & { fetched_at: string };
    if (falApiKey) {
      const b = await fetchFalBalance(falApiKey);
      falBalance = { ...b, fetched_at: timestamp };
      try {
        const { error: falError } = await adminSupabase
          .from('provider_balance_snapshots')
          .insert({
            provider: 'fal',
            balance_value: b.balance_value,
            balance_unit: b.balance_unit,
            fetched_at: timestamp,
            error_message: b.error || null,
            raw_response_json: b.error ? null : { success: true },
          });
        if (falError) console.error('Error storing fal balance snapshot:', falError);
      } catch (e) {
        console.error('Error storing fal balance snapshot:', e);
      }
      if (!b.error) {
        try {
          await supabase.functions.invoke('admin-audit-log', {
            body: {
              action_type: 'provider_balance_refresh',
              target_type: 'provider',
              target_id: 'fal',
              before_json: {},
              after_json: { balance: b.balance_value, unit: b.balance_unit },
              reason: 'Admin refreshed provider balance',
            },
          });
        } catch (_) {}
      }
    } else {
      falBalance = {
        provider: 'fal',
        balance_value: 0,
        balance_unit: 'credits',
        error: 'API key not configured (FAL_API_KEY)',
        fetched_at: timestamp,
      };
    }
    balances.push(falBalance);

    return new Response(
      JSON.stringify({ success: true, balances, fetched_at: timestamp }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error fetching provider balances:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch provider balances';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
