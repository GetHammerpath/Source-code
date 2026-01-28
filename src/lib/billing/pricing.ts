/**
 * Billing & Pricing Configuration
 * Studio Access (subscription) + Credits (pay-as-you-go)
 */

// Base cost from provider (can be overridden via env)
export const KIE_COST_PER_MINUTE = parseFloat(
  import.meta.env.VITE_KIE_COST_PER_MINUTE || "0.20"
);

// Margin multiplier
export const CREDIT_MARKUP_MULTIPLIER = parseFloat(
  // 6.67x ≈ 85% gross margin on provider cost: margin = 1 - 1/m
  import.meta.env.VITE_CREDIT_MARKUP_MULTIPLIER || "6.67"
);

// Credit consumption rate
export const CREDITS_PER_MINUTE = parseFloat(
  import.meta.env.VITE_CREDITS_PER_MINUTE || "1"
);

// Price per credit
// Formula: (KIE_COST_PER_MINUTE * CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE
export const PRICE_PER_CREDIT = (KIE_COST_PER_MINUTE * CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE;

// Rule: 1 credit = 1 rendered minute (by default)
export const MINUTES_PER_CREDIT = 1 / CREDITS_PER_MINUTE;

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
