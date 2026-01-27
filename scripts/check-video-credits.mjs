/**
 * Diagnostic script to check video generations and credit transactions
 * Run: node --env-file=.env scripts/check-video-credits.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   Required: VITE_SUPABASE_URL (or SUPABASE_URL)');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)');
  console.error('\n   You can find these in:');
  console.error('   - Supabase Dashboard → Settings → API');
  console.error('   - Or check your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkVideoCredits() {
  console.log('🔍 Checking video generations and credit status...\n');

  // Get all video generations
  const { data: generations, error: genError } = await supabase
    .from('kie_video_generations')
    .select('id, user_id, initial_status, extended_status, number_of_scenes, video_segments, final_video_url, initial_video_url, extended_video_url, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (genError) {
    console.error('❌ Error fetching generations:', genError);
    return;
  }

  console.log(`📹 Found ${generations?.length || 0} total video generations\n`);

  if (!generations || generations.length === 0) {
    console.log('✅ No videos found');
    return;
  }

  // Get all debit transactions
  const { data: debits, error: debitError } = await supabase
    .from('credit_transactions')
    .select('metadata, created_at, amount')
    .eq('type', 'debit')
    .order('created_at', { ascending: false });

  if (debitError) {
    console.error('❌ Error fetching transactions:', debitError);
    return;
  }

  const chargedGenerationIds = new Set(
    (debits || [])
      .map(tx => tx.metadata?.generation_id)
      .filter(Boolean)
  );

  console.log(`💰 Found ${debits?.length || 0} debit transactions`);
  console.log(`   ${chargedGenerationIds.size} unique generations already charged\n`);

  // Analyze each generation
  const completedVideos = [];
  const unchargedVideos = [];

  for (const gen of generations) {
    const segments = Array.isArray(gen.video_segments) ? gen.video_segments : [];
    const hasSegments = segments.length > 0 && segments.some(s => s.url || s.video_url);
    const hasInitialVideo = !!gen.initial_video_url;
    const hasExtendedVideo = !!gen.extended_video_url;
    const hasFinalVideo = !!gen.final_video_url;
    const isInitialCompleted = gen.initial_status === 'completed';
    const isExtendedCompleted = gen.extended_status === 'completed';

    const isCompleted = isInitialCompleted || isExtendedCompleted || hasFinalVideo || hasSegments || hasInitialVideo || hasExtendedVideo;

    if (isCompleted) {
      const isCharged = chargedGenerationIds.has(gen.id);
      const videoInfo = {
        id: gen.id.substring(0, 8) + '...',
        created: new Date(gen.created_at).toLocaleDateString(),
        status: {
          initial: gen.initial_status || 'none',
          extended: gen.extended_status || 'none',
        },
        hasVideos: {
          initial: hasInitialVideo,
          extended: hasExtendedVideo,
          final: hasFinalVideo,
        },
        segments: segments.length,
        scenes: gen.number_of_scenes || 1,
        charged: isCharged,
      };

      if (isCharged) {
        completedVideos.push(videoInfo);
      } else {
        unchargedVideos.push(videoInfo);
      }
    }
  }

  console.log(`✅ Completed videos: ${completedVideos.length + unchargedVideos.length}`);
  console.log(`   ✓ Already charged: ${completedVideos.length}`);
  console.log(`   ✗ Not charged: ${unchargedVideos.length}\n`);

  if (unchargedVideos.length > 0) {
    console.log('📋 Uncharged completed videos:');
    unchargedVideos.forEach((video, i) => {
      console.log(`\n${i + 1}. ${video.id} (${video.created})`);
      console.log(`   Status: initial=${video.status.initial}, extended=${video.status.extended}`);
      console.log(`   Videos: initial=${video.hasVideos.initial}, extended=${video.hasVideos.extended}, final=${video.hasVideos.final}`);
      console.log(`   Segments: ${video.segments}, Scenes: ${video.scenes}`);
      
      // Calculate expected credits
      const scenesCompleted = Math.max(video.segments, video.scenes, 1);
      const credits = Math.ceil((scenesCompleted * 8) / 60);
      console.log(`   Expected credits: ${credits}`);
    });
  }

  // Check credit balances
  const userIds = [...new Set(generations.map(g => g.user_id))];
  console.log(`\n💰 Credit balances for ${userIds.length} user(s):`);
  
  for (const userId of userIds) {
    const { data: balance, error: balanceError } = await supabase
      .from('credit_balance')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (!balanceError && balance) {
      const userVideos = generations.filter(g => g.user_id === userId);
      const userUncharged = unchargedVideos.filter(v => 
        generations.find(g => g.id.substring(0, 8) === v.id.substring(0, 8))?.user_id === userId
      );
      console.log(`   User ${userId.substring(0, 8)}...: ${balance.credits} credits (${userVideos.length} videos, ${userUncharged.length} uncharged)`);
    }
  }

  console.log('\n✅ Diagnostic complete!');
  console.log('\n💡 To charge credits for uncharged videos, click "Charge for completed videos" on the Billing page.');
}

checkVideoCredits().catch(console.error);
