import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "manager" | "contributor";

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Get all roles for user (in case they have multiple)
    const { data: rolesData, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!error && rolesData && rolesData.length > 0) {
      // Prioritize admin role if it exists, otherwise use the first role
      const adminRole = rolesData.find(r => r.role === "admin");
      const roleToUse = adminRole || rolesData[0];
      setRole(roleToUse.role as UserRole);
    } else {
      setRole(null);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isContributor = role === "contributor";
  const canManageUsers = isAdmin;
  const canViewAllRequests = isAdmin || isManager;

  return {
    role,
    loading,
    isAdmin,
    isManager,
    isContributor,
    canManageUsers,
    canViewAllRequests,
    refreshRole: fetchUserRole,
  };
};
