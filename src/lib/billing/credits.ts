/**
 * Credit Management Utilities
 * Functions for reserving, charging, and refunding credits
 */

import { supabase } from "@/integrations/supabase/client";
import { estimateCreditsForRenderedMinutes } from "./pricing";

export interface CreditCheckResult {
  hasCredits: boolean;
  currentBalance: number;
  requiredCredits: number;
  shortfall?: number;
}

/**
 * Check if user has sufficient credits for a given number of rendered minutes
 */
export async function checkCredits(renderedMinutes: number): Promise<CreditCheckResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const requiredCredits = estimateCreditsForRenderedMinutes(renderedMinutes);

  const { data: balance, error } = await supabase
    .from("credit_balance")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  const currentBalance = balance?.credits || 0;
  const hasCredits = currentBalance >= requiredCredits;
  const shortfall = hasCredits ? 0 : requiredCredits - currentBalance;

  return {
    hasCredits,
    currentBalance,
    requiredCredits,
    shortfall,
  };
}

/**
 * Reserve credits for a video generation job
 * This creates a video_jobs record and reserves credits
 */
export async function reserveCredits(
  generationId: string,
  provider: string,
  estimatedRenderedMinutes: number,
  metadata?: any
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const requiredCredits = estimateCreditsForRenderedMinutes(estimatedRenderedMinutes);

    // Check balance
    const check = await checkCredits(estimatedRenderedMinutes);
    if (!check.hasCredits) {
      return {
        success: false,
        error: `Insufficient credits. You need ${requiredCredits} credits but only have ${check.currentBalance}.`,
      };
    }

    // Create video_job record with reserved credits
    const { data: job, error: jobError } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        generation_id: generationId,
        provider,
        estimated_minutes: estimatedRenderedMinutes,
        estimated_credits: requiredCredits,
        credits_reserved: requiredCredits,
        status: "pending",
        metadata,
      })
      .select()
      .single();

    if (jobError) {
      throw jobError;
    }

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error: any) {
    console.error("Error reserving credits:", error);
    return {
      success: false,
      error: error.message || "Failed to reserve credits",
    };
  }
}

/**
 * Charge credits for a completed video generation
 * Deducts reserved credits and updates video_job status
 */
export async function chargeCredits(
  jobId: string,
  actualRenderedMinutes?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      throw new Error("Video job not found");
    }

    const actualCredits = actualRenderedMinutes
      ? estimateCreditsForRenderedMinutes(actualRenderedMinutes)
      : job.estimated_credits;

    // Get current balance
    const { data: balance, error: balanceError } = await supabase
      .from("credit_balance")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (balanceError) {
      throw balanceError;
    }

    const currentBalance = balance?.credits || 0;

    if (currentBalance < actualCredits) {
      throw new Error(
        `Insufficient credits. Need ${actualCredits} but only have ${currentBalance}`
      );
    }

    const newBalance = currentBalance - actualCredits;

    // Update credit balance
    const { error: updateError } = await supabase
      .from("credit_balance")
      .update({ credits: newBalance })
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    // Create debit transaction
    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: user.id,
      type: "debit",
      amount: -actualCredits,
      balance_after: newBalance,
      metadata: {
        job_id: jobId,
        generation_id: job.generation_id,
        actual_minutes: actualRenderedMinutes || job.estimated_minutes,
      },
    });

    if (txError) {
      console.error("Error creating transaction record:", txError);
    }

    // Update job
    const { error: jobUpdateError } = await supabase
      .from("video_jobs")
      .update({
        status: "completed",
        actual_minutes: actualRenderedMinutes || job.estimated_minutes,
        credits_charged: actualCredits,
        credits_reserved: 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (jobUpdateError) {
      console.error("Error updating job:", jobUpdateError);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error charging credits:", error);
    return {
      success: false,
      error: error.message || "Failed to charge credits",
    };
  }
}

/**
 * Refund credits for a failed video generation
 * Releases reserved credits back to user
 */
export async function refundCredits(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      throw new Error("Video job not found");
    }

    const reservedCredits = job.credits_reserved || 0;

    if (reservedCredits === 0) {
      // No credits to refund
      return { success: true };
    }

    // Get current balance
    const { data: balance, error: balanceError } = await supabase
      .from("credit_balance")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (balanceError) {
      throw balanceError;
    }

    const currentBalance = balance?.credits || 0;
    const newBalance = currentBalance + reservedCredits;

    // Update credit balance
    const { error: updateError } = await supabase
      .from("credit_balance")
      .update({ credits: newBalance })
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    // Create refund transaction
    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: user.id,
      type: "refund",
      amount: reservedCredits,
      balance_after: newBalance,
      metadata: {
        job_id: jobId,
        generation_id: job.generation_id,
        reason: "generation_failed",
      },
    });

    if (txError) {
      console.error("Error creating refund transaction:", txError);
    }

    // Update job
    const { error: jobUpdateError } = await supabase
      .from("video_jobs")
      .update({
        status: "failed",
        credits_reserved: 0,
      })
      .eq("id", jobId);

    if (jobUpdateError) {
      console.error("Error updating job:", jobUpdateError);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error refunding credits:", error);
    return {
      success: false,
      error: error.message || "Failed to refund credits",
    };
  }
}
