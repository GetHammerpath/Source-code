/**
 * Audit Logging Utilities
 * Functions to create audit log entries for admin actions
 */

import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  actor_admin_user_id: string;
  action_type: string;
  target_type: string;
  target_id?: string;
  before_json?: any;
  after_json?: any;
  reason: string;
}

/**
 * Create an audit log entry
 * Must be called from an admin context
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Verify user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      throw new Error("Only admins can create audit logs");
    }

    // Create audit log via Edge Function (for security)
    const { error } = await supabase.functions.invoke("admin-audit-log", {
      body: {
        ...entry,
        actor_admin_user_id: user.id,
      },
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error creating audit log:", error);
    return {
      success: false,
      error: error.message || "Failed to create audit log",
    };
  }
}

/**
 * Helper to create audit log with before/after comparison
 */
export async function auditAction(
  actionType: string,
  targetType: string,
  targetId: string | undefined,
  before: any,
  after: any,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    actor_admin_user_id: "", // Will be filled by the function
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    before_json: before,
    after_json: after,
    reason,
  });
}
