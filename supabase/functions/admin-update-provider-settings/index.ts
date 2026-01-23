import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      throw new Error('Only admins can update provider settings');
    }

    const body = await req.json();
    const { provider, user_id, enabled, settings, reason } = body;

    if (!provider || reason === undefined) {
      throw new Error('Missing required fields: provider, reason');
    }

    const userIdForDb = user_id ?? null;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let q = supabaseAdmin.from('provider_settings').select('*').eq('provider', provider);
    if (userIdForDb == null) {
      q = q.is('user_id', null);
    } else {
      q = q.eq('user_id', userIdForDb);
    }
    const { data: currentSettings } = await q.maybeSingle();

    const beforeJson = currentSettings ?? null;
    const s = settings || {};

    const updateData: Record<string, unknown> = {
      provider,
      user_id: userIdForDb,
      enabled: enabled !== undefined ? enabled : (currentSettings?.enabled ?? true),
      max_retries: s.max_retries ?? currentSettings?.max_retries ?? 3,
      timeout_seconds: s.timeout_seconds ?? currentSettings?.timeout_seconds ?? 300,
      max_duration_per_job: s.max_duration_per_job ?? currentSettings?.max_duration_per_job ?? 300,
      concurrency_limit: s.concurrency_limit ?? currentSettings?.concurrency_limit ?? 5,
      emergency_pause: s.emergency_pause ?? currentSettings?.emergency_pause ?? false,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSettings, error: updateError } = await supabaseAdmin
      .from('provider_settings')
      .upsert(updateData, { onConflict: 'provider,user_id' })
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update settings: ${updateError.message}`);
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const auditTargetId = user_id != null && typeof user_id === 'string' && UUID_RE.test(user_id) ? user_id : null;

    const { error: auditError } = await supabaseAdmin
      .from('audit_log')
      .insert({
        actor_admin_user_id: user.id,
        action_type: 'provider_settings_update',
        target_type: 'provider',
        target_id: auditTargetId,
        before_json: beforeJson,
        after_json: updatedSettings,
        reason,
      });

    if (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Don't fail the request if audit log fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        settings: updatedSettings,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error updating provider settings:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update provider settings';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
