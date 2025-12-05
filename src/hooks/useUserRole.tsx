import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "manager" | "contributor";

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setRole(data.role as UserRole);
      }
      
      setLoading(false);
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

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
  };
};
