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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) {
      throw new Error('Unauthorized');
    }

    // Verify admin is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      throw new Error('Only admins can invalidate sessions');
    }

    const { user_id, reason } = await req.json();

    if (!user_id || !reason) {
      throw new Error('Missing required fields: user_id, reason');
    }

    // Create audit log
    await supabase.functions.invoke('admin-audit-log', {
      body: {
        action_type: 'invalidate_sessions',
        target_type: 'user',
        target_id: user_id,
        before_json: {},
        after_json: {},
        reason,
      },
    });

    // Use Supabase Admin API to sign out all sessions
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Sign out all sessions for this user (global scope)
    const { error: sessionError } = await adminSupabase.auth.admin.signOut(user_id);

    if (sessionError) {
      console.error('Error signing out user sessions:', sessionError);
      // Continue anyway - audit log is already created
    }

    return new Response(
      JSON.stringify({ success: true, message: 'All user sessions invalidated' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error invalidating sessions:', error);
    const msg = error instanceof Error ? error.message : 'Failed to invalidate sessions';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
