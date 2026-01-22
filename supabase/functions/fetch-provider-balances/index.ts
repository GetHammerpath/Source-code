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
    // Kie.ai API endpoint for account/balance (adjust based on actual API)
    const response = await fetch('https://api.kie.ai/v1/account/balance', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kie API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Adjust based on actual Kie API response structure
    return {
      provider: 'kie',
      balance_value: data.balance || data.credits || 0,
      balance_unit: data.currency || 'credits',
    };
  } catch (error: any) {
    console.error('Error fetching Kie balance:', error);
    return {
      provider: 'kie',
      balance_value: 0,
      balance_unit: 'credits',
      error: error.message || 'Failed to fetch Kie balance',
    };
  }
}

async function fetchFalBalance(apiKey: string): Promise<ProviderBalance> {
  try {
    // fal.ai API endpoint for account/balance (adjust based on actual API)
    // Note: fal.ai uses a different auth pattern (key_id:key_secret)
    const [keyId, keySecret] = apiKey.split(':');
    
    const response = await fetch('https://fal.run/api/v1/account/balance', {
      headers: {
        'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Adjust based on actual fal API response structure
    return {
      provider: 'fal',
      balance_value: data.balance || data.credits || 0,
      balance_unit: data.currency || 'credits',
    };
  } catch (error: any) {
    console.error('Error fetching fal balance:', error);
    return {
      provider: 'fal',
      balance_value: 0,
      balance_unit: 'credits',
      error: error.message || 'Failed to fetch fal balance',
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
    const kieApiKey = Deno.env.get('KIE_AI_API_TOKEN');
    const falApiKey = Deno.env.get('FAL_API_KEY');

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const balances: ProviderBalance[] = [];
    const timestamp = new Date().toISOString();

    // Fetch Kie balance
    if (kieApiKey) {
      const kieBalance = await fetchKieBalance(kieApiKey);
      balances.push(kieBalance);

      // Store in database
      const { error: kieError } = await adminSupabase
        .from('provider_balance_snapshots')
        .insert({
          provider: 'kie',
          balance_value: kieBalance.balance_value,
          balance_unit: kieBalance.balance_unit,
          fetched_at: timestamp,
          error_message: kieBalance.error || null,
          raw_response_json: kieBalance.error ? null : { success: true },
        });

      if (kieError) {
        console.error('Error storing Kie balance snapshot:', kieError);
      }

      // Create audit log for refresh
      if (!kieBalance.error) {
        await supabase.functions.invoke('admin-audit-log', {
          body: {
            action_type: 'provider_balance_refresh',
            target_type: 'provider',
            target_id: 'kie',
            before_json: {},
            after_json: { balance: kieBalance.balance_value, unit: kieBalance.balance_unit },
            reason: 'Admin refreshed provider balance',
          },
        });
      }
    }

    // Fetch fal balance
    if (falApiKey) {
      const falBalance = await fetchFalBalance(falApiKey);
      balances.push(falBalance);

      // Store in database
      const { error: falError } = await adminSupabase
        .from('provider_balance_snapshots')
        .insert({
          provider: 'fal',
          balance_value: falBalance.balance_value,
          balance_unit: falBalance.balance_unit,
          fetched_at: timestamp,
          error_message: falBalance.error || null,
          raw_response_json: falBalance.error ? null : { success: true },
        });

      if (falError) {
        console.error('Error storing fal balance snapshot:', falError);
      }

      // Create audit log for refresh
      if (!falBalance.error) {
        await supabase.functions.invoke('admin-audit-log', {
          body: {
            action_type: 'provider_balance_refresh',
            target_type: 'provider',
            target_id: 'fal',
            before_json: {},
            after_json: { balance: falBalance.balance_value, unit: falBalance.balance_unit },
            reason: 'Admin refreshed provider balance',
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, balances, fetched_at: timestamp }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching provider balances:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
