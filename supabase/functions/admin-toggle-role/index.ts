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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get user email to check if they're mershard@icloud.com
    const { data: { user: fullUser } } = await supabase.auth.getUser();
    const isMershard = fullUser?.email === 'mershard@icloud.com';

    // Verify user is currently an admin OR is mershard@icloud.com (required to toggle)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    // Only allow toggling if they're currently admin OR if they're mershard@icloud.com
    if (!roleData && !isMershard) {
      throw new Error('Only admins can toggle roles');
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // Check current admin status
    const { data: currentAdminRole } = await adminSupabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const hadAdmin = !!currentAdminRole;
    let newRole: 'admin' | 'user';

    if (hadAdmin) {
      // Remove admin role (become user)
      const { error: deleteError } = await adminSupabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id)
        .eq('role', 'admin');

      if (deleteError) {
        throw new Error(`Failed to remove admin role: ${deleteError.message}`);
      }
      newRole = 'user';
    } else {
      // Add admin role (become admin)
      const { error: insertError } = await adminSupabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin',
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        throw new Error(`Failed to add admin role: ${insertError.message}`);
      }
      newRole = 'admin';
    }

    // Create audit log
    try {
      await supabase.functions.invoke('admin-audit-log', {
        body: {
          action_type: 'role_toggle',
          target_type: 'user',
          target_id: user.id,
          before_json: { role: hadAdmin ? 'admin' : 'user' },
          after_json: { role: newRole },
          reason: `User toggled role from ${hadAdmin ? 'admin' : 'user'} to ${newRole}`,
        },
      });
    } catch (auditErr) {
      console.error('Failed to create audit log:', auditErr);
      // Continue anyway
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        role: newRole,
        message: `Role changed to ${newRole}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error toggling role:', error);
    const msg = error instanceof Error ? error.message : 'Failed to toggle role';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
