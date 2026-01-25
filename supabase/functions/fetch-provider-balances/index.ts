import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProviderBalance {
  provider: 'kie';
  balance_value: number;
  balance_unit: string;
  error?: string;
}

async function fetchKieBalance(apiKey: string): Promise<ProviderBalance> {
  try {
    // Kie.ai credits API: GET /api/v1/chat/credit
    // Response: { "code": 200, "msg": "success", "data": 100 }
    const response = await fetch('https://api.kie.ai/api/v1/chat/credit', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await response.json().catch(() => ({}));
    console.log('Kie credits response:', JSON.stringify(json));

    if (!response.ok) {
      const errMsg = json?.msg || json?.message || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    if (json.code !== 200) {
      throw new Error(json.msg || 'Kie API returned non-success');
    }

    const balance = typeof json.data === 'number' ? json.data : parseFloat(String(json.data || 0)) || 0;

    return {
      provider: 'kie',
      balance_value: balance,
      balance_unit: 'credits',
    };
  } catch (error: any) {
    console.error('Error fetching Kie balance:', error);
    return {
      provider: 'kie',
      balance_value: 0,
      balance_unit: 'credits',
      error: error.message || 'Failed to fetch Kie credits',
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

    // Get API keys from environment (KIE only)
    const kieApiKey = Deno.env.get('KIE_AI_API_TOKEN') || Deno.env.get('KIE_API_KEY');
    
    if (!kieApiKey) {
      console.warn('KIE_AI_API_TOKEN or KIE_API_KEY not set');
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
