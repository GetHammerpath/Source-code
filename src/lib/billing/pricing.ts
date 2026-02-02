/**
 * Billing & Pricing Configuration
 * Studio Access (subscription) + Credits (pay-as-you-go)
 */

import { getVideoModel } from "@/lib/video-models";

// Base cost from provider (can be overridden via env)
export const KIE_COST_PER_MINUTE = parseFloat(
  import.meta.env.VITE_KIE_COST_PER_MINUTE || "0.20"
);

// CREDIT MODEL (Option B):
// - 1 video segment (~8 seconds) = 1 credit
// - 3 segments (24s) = 3 credits and should be >= $10
//
// Credit consumption rate:
// With 1 credit ≈ 1 segment (~8s), that's 7.5 credits per rendered minute.
export const CREDITS_PER_MINUTE = parseFloat(import.meta.env.VITE_CREDITS_PER_MINUTE || "7.5");

// Price per credit:
// Default to $3.34 so 3 credits ~= $10.02 (minimum >= $10).
// You can override exactly via VITE_PRICE_PER_CREDIT, e.g. 3.3333333333.
export const PRICE_PER_CREDIT = parseFloat(import.meta.env.VITE_PRICE_PER_CREDIT || "3.34");

export const MINUTES_PER_CREDIT = 1 / CREDITS_PER_MINUTE;

/**
 * Estimate credits needed for a given number of rendered segments.
 * Under the default schema, 1 segment (~8s) = 1 credit.
 */
export function estimateCreditsForSegments(segments: number): number {
  return Math.max(0, Math.ceil(segments));
}

/**
 * Estimate credits for a given model and segment count.
 * Uses video-models catalog for model-specific rates.
 */
export function estimateCreditsForModel(segments: number, modelId: string): number {
  const model = getVideoModel(modelId);
  const rate = model?.creditsPerSegment ?? 1;
  return Math.max(0, Math.ceil(segments * rate));
}

// Keep these for reference/analytics (not used for default pricing anymore).
export const CREDIT_MARKUP_MULTIPLIER = parseFloat(import.meta.env.VITE_CREDIT_MARKUP_MULTIPLIER || "1");

// Studio Access Subscription
export interface StudioAccess {
  name: string;
  price: number; // Monthly fee
  stripePriceId?: string; // Stripe Price ID for subscription
  description: string;
  features: string[];
}

export const STUDIO_ACCESS: StudioAccess = {
  name: "Studio Access",
  price: 99,
  stripePriceId: import.meta.env.VITE_STUDIO_ACCESS_PRICE_ID,
  description: "Unlock the studio (orchestration UI, integrations, team workflows)",
  features: [
    "Studio & orchestration UI",
    "Provider integrations framework",
    "Team collaboration tools",
    "Compliance tooling",
    "Workflow management",
    "Quality gates & retries",
  ],
};

/**
 * Calculate price for a given number of credits
 */
export function calculateCreditPrice(credits: number): number {
  return credits * PRICE_PER_CREDIT;
}

/**
 * Estimate credits needed for a given number of rendered minutes
 * (based on CREDITS_PER_MINUTE; default schema makes this equivalent to segments).
 */
export function estimateCreditsForRenderedMinutes(renderedMinutes: number): number {
  return Math.ceil(renderedMinutes * CREDITS_PER_MINUTE);
}

/**
 * Calculate estimated cost in dollars for rendered minutes
 */
export function estimateCostForRenderedMinutes(renderedMinutes: number): number {
  const credits = estimateCreditsForRenderedMinutes(renderedMinutes);
  return calculateCreditPrice(credits);
}

/**
 * Estimate cost in dollars for a model and segment count.
 */
export function estimateCostForModel(segments: number, modelId: string): number {
  const credits = estimateCreditsForModel(segments, modelId);
  return calculateCreditPrice(credits);
}
