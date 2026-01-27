/**
 * Retroactively charge credits for completed video generations that weren't charged
 * Run this to fix videos that completed before the credit charging logic was fixed
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables are loaded via --env-file flag in package.json
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) in .env');
  console.error('   Required: VITE_SUPABASE_URL (or SUPABASE_URL)');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function retroactivelyChargeCredits() {
  console.log('🔍 Finding completed videos without credit charges...\n');

  // Find all completed generations that:
  // 1. Have initial_status = 'completed' or extended_status = 'completed'
  // 2. Don't have a corresponding debit transaction
  const { data: generations, error: genError } = await supabase
    .from('kie_video_generations')
    .select('id, user_id, initial_status, extended_status, number_of_scenes, video_segments, created_at')
    .or('initial_status.eq.completed,extended_status.eq.completed')
    .order('created_at', { ascending: false })
    .limit(100);

  if (genError) {
    console.error('❌ Error fetching generations:', genError);
    return;
  }

  console.log(`Found ${generations?.length || 0} completed generations\n`);

  if (!generations || generations.length === 0) {
    console.log('✅ No completed videos found');
    return;
  }

  // Check which ones already have debit transactions
  const { data: existingDebits, error: debitError } = await supabase
    .from('credit_transactions')
    .select('metadata')
    .eq('type', 'debit');

  if (debitError) {
    console.error('❌ Error fetching transactions:', debitError);
    return;
  }

  const chargedGenerationIds = new Set(
    (existingDebits || [])
      .map(tx => tx.metadata?.generation_id)
      .filter(Boolean)
  );

  const unchargedGenerations = (generations || []).filter(
    gen => !chargedGenerationIds.has(gen.id)
  );

  console.log(`📊 ${unchargedGenerations.length} videos need credit charging\n`);

  if (unchargedGenerations.length === 0) {
    console.log('✅ All completed videos have been charged');
    return;
  }

  // Charge credits for each uncharged generation
  for (const gen of unchargedGenerations) {
    try {
      // Calculate scenes completed
      const segments = gen.video_segments || [];
      const scenesCompleted = Math.max(
        segments.length,
        gen.number_of_scenes || 1,
        (gen.initial_status === 'completed' ? 1 : 0) + (gen.extended_status === 'completed' ? 1 : 0)
      );

      // Calculate credits (8 seconds per scene = ~0.133 minutes per scene)
      const actualRenderedMinutes = (scenesCompleted * 8) / 60;
      const actualCredits = Math.ceil(actualRenderedMinutes);

      console.log(`\n🎬 Generation ${gen.id.substring(0, 8)}...`);
      console.log(`   Scenes: ${scenesCompleted}, Credits: ${actualCredits}`);

      // Get current balance
      const { data: balance, error: balanceError } = await supabase
        .from('credit_balance')
        .select('credits')
        .eq('user_id', gen.user_id)
        .single();

      if (balanceError) {
        console.error(`   ❌ Failed to get balance: ${balanceError.message}`);
        continue;
      }

      const currentBalance = balance?.credits || 0;
      const newBalance = Math.max(0, currentBalance - actualCredits);

      // Update credit balance
      const { error: updateError } = await supabase
        .from('credit_balance')
        .update({ credits: newBalance })
        .eq('user_id', gen.user_id);

      if (updateError) {
        console.error(`   ❌ Failed to update balance: ${updateError.message}`);
        continue;
      }

      // Create debit transaction
      const { error: txError } = await supabase.from('credit_transactions').insert({
        user_id: gen.user_id,
        type: 'debit',
        amount: -actualCredits,
        balance_after: newBalance,
        metadata: {
          generation_id: gen.id,
          actual_minutes: actualRenderedMinutes,
          scenes_completed: scenesCompleted,
          retroactive: true,
          charged_at: new Date().toISOString()
        }
      });

      if (txError) {
        console.error(`   ❌ Failed to create transaction: ${txError.message}`);
        continue;
      }

      console.log(`   ✅ Charged ${actualCredits} credits. Balance: ${currentBalance} → ${newBalance}`);
    } catch (error) {
      console.error(`   ❌ Error processing generation ${gen.id}:`, error);
    }
  }

  console.log('\n✅ Retroactive credit charging complete!');
}

retroactivelyChargeCredits().catch(console.error);
