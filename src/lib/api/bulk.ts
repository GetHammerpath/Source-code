import { supabase } from "@/integrations/supabase/client";

/** Row payload for bulk-generate-videos API */
export interface LaunchRow {
  avatar_id?: string;
  avatar_name?: string;
  script: string;
  background?: string;
  aspect_ratio?: string;
}

export interface LaunchBaseConfig {
  name: string;
  imageUrl: string | null;
  industry: string;
  city: string;
  storyIdea?: string;
  model: string;
  aspectRatio: string;
  numberOfScenes: number;
  generationType: "REFERENCE_2_VIDEO" | "TEXT_2_VIDEO";
}

/** Source door: csv | ai | spinner */
export type BatchSourceType = "csv" | "ai" | "spinner";

export interface BatchStatus {
  batch_id: string;
  name: string;
  source_type?: BatchSourceType;
  status: string;
  progress: number;
  completed_count: number;
  total_count: number;
  failed_count: number;
  pending_count: number;
  time_remaining_estimate_sec: number | null;
  videos: Array<{
    id: string;
    variation_index: number;
    status: string;
    video_url: string | null;
    thumbnail_url?: string | null;
  }>;
}

export interface LaunchResult {
  batch_id: string;
}

function toRowsPayload(rows: LaunchRow[]) {
  return rows.map((r) => {
    const isAutoCast = r.avatar_id?.startsWith("__");
    return {
      avatar_id: isAutoCast ? undefined : (r.avatar_id || undefined),
      avatar_name: r.avatar_name || undefined,
      script: r.script,
      background: r.background || undefined,
      aspect_ratio: r.aspect_ratio || "16:9",
    };
  });
}

export async function launchBatch(
  userId: string,
  rows: LaunchRow[],
  baseConfig: LaunchBaseConfig,
  isTestRun: boolean,
  sourceType: BatchSourceType = "csv"
): Promise<LaunchResult> {
  const generationType = baseConfig.generationType;
  const imageUrl = baseConfig.imageUrl;

  const { data: batch, error: batchError } = await supabase
    .from("bulk_video_batches")
    .insert([
      {
        user_id: userId,
        name: baseConfig.name,
        base_image_url: imageUrl,
        base_industry: baseConfig.industry,
        base_city: baseConfig.city,
        base_story_idea: baseConfig.storyIdea || null,
        variables: [],
        total_variations: rows.length,
        model: baseConfig.model,
        aspect_ratio: baseConfig.aspectRatio,
        number_of_scenes: baseConfig.numberOfScenes,
        status: "generating",
        generation_type: generationType,
        source_type: sourceType,
        total_rows: rows.length,
      },
    ])
    .select()
    .single();

  if (batchError) throw batchError;

  const rowsPayload = toRowsPayload(rows);
  const base_config = {
    image_url: imageUrl,
    generation_type: generationType,
    industry: baseConfig.industry,
    city: baseConfig.city,
    story_idea: baseConfig.storyIdea || undefined,
    model: baseConfig.model,
    aspect_ratio: baseConfig.aspectRatio,
    number_of_scenes: baseConfig.numberOfScenes,
    sample_size: isTestRun ? 3 : null,
  };

  const { error: funcError } = await supabase.functions.invoke("bulk-generate-videos", {
    body: {
      batch_id: batch.id,
      rows: rowsPayload,
      base_config,
      source_type: sourceType,
    },
  });

  if (funcError) throw funcError;

  return { batch_id: batch.id };
}

export async function getBatchStatus(batchId: string): Promise<BatchStatus | null> {
  const { data: batch, error: batchError } = await supabase
    .from("bulk_video_batches")
    .select("id, name, status, source_type, total_variations, completed_variations, failed_variations")
    .eq("id", batchId)
    .single();

  if (batchError || !batch) return null;

  const { data: linkData } = await supabase
    .from("bulk_batch_generations")
    .select(`
      generation_id,
      variation_index,
      generation:kie_video_generations(
        id,
        initial_status,
        final_video_status,
        initial_video_url,
        final_video_url
      )
    `)
    .eq("batch_id", batchId)
    .order("variation_index", { ascending: true });

  const total = batch.total_variations ?? 0;
  const completed = batch.completed_variations ?? 0;
  const failed = batch.failed_variations ?? 0;
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  const pending = Math.max(0, total - completed - failed);

  const videos = (linkData || []).map((link: Record<string, unknown>) => {
    const gen = (link.generation as Record<string, unknown>) || {};
    const status = (gen.final_video_status as string) || (gen.initial_status as string) || "pending";
    const videoUrl =
      (gen.final_video_url as string) || (gen.initial_video_url as string) || null;
    return {
      id: (gen.id as string) || "",
      variation_index: (link.variation_index as number) ?? 0,
      status,
      video_url: videoUrl,
    };
  });

  const avgSecPerVideo = 60;
  const time_remaining_estimate_sec =
    pending > 0 ? pending * avgSecPerVideo : null;

  return {
    batch_id: batch.id,
    name: batch.name ?? "Batch",
    source_type: (batch.source_type as BatchSourceType) ?? undefined,
    status: batch.status ?? "unknown",
    progress,
    completed_count: completed,
    total_count: total,
    failed_count: failed,
    pending_count: pending,
    time_remaining_estimate_sec,
    videos,
  };
}

export async function resumeBatch(batchId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("resume-bulk-batch", {
    body: { batch_id: batchId },
  });
  if (error) throw error;
}

export async function abortBatch(batchId: string): Promise<void> {
  const { error } = await supabase
    .from("bulk_video_batches")
    .update({ status: "cancelled", is_paused: true })
    .eq("id", batchId);

  if (error) throw error;
}

export async function retryFailedBatch(batchId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("retry-failed-generations", {
    body: { batch_id: batchId },
  });
  if (error) throw error;
}
