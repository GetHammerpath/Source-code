/**
 * Video model catalog with pricing (credits per segment).
 * Option 2 for Veo 3.1 Quality: 3 credits/segment (accessible premium).
 * Phase 4: Added fallback support and text-to-video flags.
 */

export interface VideoModel {
  id: string;
  label: string;
  provider: "kie-veo" | "kie-sora2" | "kie-kling";
  /** Credits per segment (~8s). Veo Fast = 1; Veo Quality = 3 (Option 2). */
  creditsPerSegment: number;
  aspectRatios: readonly ["16:9", "9:16"];
  maxScenes: number;
  /** REFERENCE_2_VIDEO (image mode) support */
  supportsReference2Video?: boolean;
  /** TEXT_2_VIDEO (text-only mode) support */
  supportsText2Video?: boolean;
  /** Phase 1: available in Studio */
  supportedInStudio: boolean;
  /** Phase 1: available in Bulk */
  supportedInBulk: boolean;
  /** Phase 4: Fallback model ID when this model fails */
  fallbackModel?: string;
}

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "veo3_fast",
    label: "Veo 3.1 Fast",
    provider: "kie-veo",
    creditsPerSegment: 1,
    aspectRatios: ["16:9", "9:16"],
    maxScenes: 10,
    supportsReference2Video: true,
    supportsText2Video: true,
    supportedInStudio: true,
    supportedInBulk: true,
    fallbackModel: "sora2_pro_720", // Phase 4: fallback to Sora2 on failure
  },
  {
    id: "veo3",
    label: "Veo 3.1 Quality",
    provider: "kie-veo",
    creditsPerSegment: 3,
    aspectRatios: ["16:9", "9:16"],
    maxScenes: 10,
    supportsReference2Video: false,
    supportsText2Video: true,
    supportedInStudio: true,
    supportedInBulk: true,
    fallbackModel: "veo3_fast", // Phase 4: fallback to Fast on failure
  },
  {
    id: "sora2_pro_720",
    label: "Sora 2 Pro (720p)",
    provider: "kie-sora2",
    creditsPerSegment: 1,
    aspectRatios: ["16:9", "9:16"],
    maxScenes: 8,
    supportsReference2Video: true,
    supportsText2Video: false, // Sora2 is image-to-video only
    supportedInStudio: true,
    supportedInBulk: true, // Phase 4: enabled for image-based bulk
    fallbackModel: "veo3_fast", // Phase 4: fallback to Veo on failure
  },
  {
    id: "sora2_pro_1080",
    label: "Sora 2 Pro (1080p)",
    provider: "kie-sora2",
    creditsPerSegment: 2,
    aspectRatios: ["16:9", "9:16"],
    maxScenes: 8,
    supportsReference2Video: true,
    supportsText2Video: false, // Sora2 is image-to-video only
    supportedInStudio: true,
    supportedInBulk: true, // Phase 4: enabled for image-based bulk
    fallbackModel: "sora2_pro_720", // Phase 4: fallback to 720p on failure
  },
  {
    id: "kling_2_6",
    label: "Kling 2.6",
    provider: "kie-kling",
    creditsPerSegment: 2,
    aspectRatios: ["16:9", "9:16"],
    maxScenes: 1, // Kling is single-scene only
    supportsReference2Video: true,
    supportsText2Video: false, // Kling is image-to-video only
    supportedInStudio: true,
    supportedInBulk: true, // Phase 4: enabled for image-based bulk
    fallbackModel: "veo3_fast", // Phase 4: fallback to Veo on failure
  },
];

export function getVideoModel(modelId: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.id === modelId);
}

export function getSupportedStudioModels(reference2Video: boolean): VideoModel[] {
  return VIDEO_MODELS.filter(
    (m) =>
      m.supportedInStudio &&
      (!reference2Video || m.supportsReference2Video)
  );
}

/**
 * Get models supported in Bulk.
 * @param hasImage - If true, include image-only models (Sora2, Kling). If false, only text-capable models.
 */
export function getSupportedBulkModels(hasImage?: boolean): VideoModel[] {
  return VIDEO_MODELS.filter((m) => {
    if (!m.supportedInBulk) return false;
    // If hasImage is explicitly false, only return text-capable models
    if (hasImage === false && !m.supportsText2Video) return false;
    return true;
  });
}

/**
 * Phase 4: Get the fallback model for a given model ID.
 * Returns undefined if no fallback is configured.
 */
export function getFallbackModel(modelId: string): VideoModel | undefined {
  const model = getVideoModel(modelId);
  if (!model?.fallbackModel) return undefined;
  return getVideoModel(model.fallbackModel);
}

/**
 * Phase 4: Check if a model supports the given generation type.
 */
export function modelSupportsGenerationType(
  modelId: string,
  generationType: "TEXT_2_VIDEO" | "REFERENCE_2_VIDEO"
): boolean {
  const model = getVideoModel(modelId);
  if (!model) return false;
  if (generationType === "TEXT_2_VIDEO") return model.supportsText2Video === true;
  if (generationType === "REFERENCE_2_VIDEO") return model.supportsReference2Video === true;
  return false;
}

/**
 * Phase 4: Get fallback chain for a model (for display/logging).
 * Returns array of model IDs in fallback order.
 */
export function getFallbackChain(modelId: string, maxDepth = 3): string[] {
  const chain: string[] = [modelId];
  let current = modelId;
  for (let i = 0; i < maxDepth; i++) {
    const model = getVideoModel(current);
    if (!model?.fallbackModel || chain.includes(model.fallbackModel)) break;
    chain.push(model.fallbackModel);
    current = model.fallbackModel;
  }
  return chain;
}
