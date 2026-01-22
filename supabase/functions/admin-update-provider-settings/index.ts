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

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current settings
    const { data: currentSettings } = await supabaseAdmin
      .from('provider_settings')
      .select('*')
      .eq('provider', provider)
      .eq('user_id', user_id || 'global')
      .single();

    const beforeJson = currentSettings || null;

    // Update or insert settings
    const updateData: any = {
      provider,
      user_id: user_id || 'global',
      enabled: enabled !== undefined ? enabled : (currentSettings?.enabled ?? true),
      settings: settings || currentSettings?.settings || {},
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSettings, error: updateError } = await supabaseAdmin
      .from('provider_settings')
      .upsert(updateData, {
        onConflict: 'provider,user_id',
      })
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update settings: ${updateError.message}`);
    }

    // Create audit log
    const { error: auditError } = await supabaseAdmin
      .from('audit_log')
      .insert({
        actor_admin_user_id: user.id,
        action_type: 'provider_settings_update',
        target_type: 'provider',
        target_id: user_id || 'global',
        before_json: beforeJson,
        after_json: updatedSettings,
        reason: reason,
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
  } catch (error: any) {
    console.error('Error updating provider settings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
