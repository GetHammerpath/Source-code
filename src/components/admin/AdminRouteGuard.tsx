import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface AdminRouteGuardProps {
  children: ReactNode;
}

/**
 * AdminRouteGuard - Protects admin routes
 * Ensures only admin users can access admin pages
 * Note: AppShell is provided by AuthWrapper, so we don't wrap here
 */
export const AdminRouteGuard = ({ children }: AdminRouteGuardProps) => {
  const navigate = useNavigate();
  const { isAdmin, loading, role } = useUserRole();

  useEffect(() => {
    if (!loading && !isAdmin) {
      console.log("AdminRouteGuard: User is not admin, redirecting to dashboard. Role:", role);
      navigate("/dashboard");
    }
  }, [isAdmin, loading, navigate, role]);

  if (loading) {
    console.log("AdminRouteGuard: Loading user role...");
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    console.log("AdminRouteGuard: Not admin, showing redirect message. Role:", role);
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
          <p className="text-sm text-muted-foreground">Current role: {role || "none"}</p>
        </div>
      </div>
    );
  }

  console.log("AdminRouteGuard: Admin access granted, rendering children");
  return <>{children}</>;
};
