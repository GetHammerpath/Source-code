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
      throw new Error('Only admins can adjust credits');
    }

    const body = await req.json();
    const { target_user_id, amount, reason, type } = body;

    if (!target_user_id || !amount || !reason || !type) {
      throw new Error('Missing required fields: target_user_id, amount, reason, type');
    }

    if (type !== 'adjustment' && type !== 'grant' && type !== 'debit') {
      throw new Error('Invalid type. Must be: adjustment, grant, or debit');
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // Get current balance
    const { data: currentBalance, error: balanceError } = await supabaseAdmin
      .from('credit_balance')
      .select('credits')
      .eq('user_id', target_user_id)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      throw new Error(`Failed to get balance: ${balanceError.message}`);
    }

    const currentCredits = currentBalance?.credits || 0;
    const adjustmentAmount = parseInt(amount);
    const newBalance = currentCredits + adjustmentAmount;

    if (newBalance < 0) {
      throw new Error(`Insufficient credits. Current: ${currentCredits}, Adjustment: ${adjustmentAmount}`);
    }

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('credit_balance')
      .upsert({
        user_id: target_user_id,
        credits: newBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (updateError) {
      throw new Error(`Failed to update balance: ${updateError.message}`);
    }

    // Create transaction record
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: target_user_id,
        type: type,
        amount: adjustmentAmount,
        balance_after: newBalance,
        metadata: {
          reason,
          adjusted_by: user.id,
          adjusted_by_email: user.email,
        },
      });

    if (transactionError) {
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }

    // Create audit log
    const { error: auditError } = await supabaseAdmin
      .from('audit_log')
      .insert({
        actor_admin_user_id: user.id,
        action_type: 'credit_adjustment',
        target_type: 'user',
        target_id: target_user_id,
        before_json: { credits: currentCredits },
        after_json: { credits: newBalance },
        reason: reason,
      });

    if (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Don't fail the request if audit log fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        previous_balance: currentCredits,
        new_balance: newBalance,
        adjustment: adjustmentAmount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error adjusting credits:', error);
    const msg = error instanceof Error ? error.message : 'Failed to adjust credits';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
