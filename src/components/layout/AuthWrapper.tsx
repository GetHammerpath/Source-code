import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

interface AuthWrapperProps {
  children: ReactNode;
  requireAuth?: boolean;
}

const AuthWrapper = ({ children, requireAuth = true }: AuthWrapperProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!requireAuth) {
          setAuthenticated(true);
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth error:", error);
        }
        if (!session) {
          navigate("/auth");
        } else {
          setAuthenticated(true);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error checking auth:", error);
        setLoading(false);
        // Still redirect to auth on error
        if (requireAuth) {
          navigate("/auth");
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (requireAuth && !session) {
        navigate("/auth");
      } else {
        setAuthenticated(!!session);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [requireAuth, navigate]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse space-y-4 w-full max-w-md px-6">
            <div className="h-8 bg-muted rounded-[14px] w-3/4" />
            <div className="h-64 bg-muted rounded-[14px]" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!requireAuth || authenticated) {
    return <AppShell>{children}</AppShell>;
  }

  // Still show loading if redirecting
  return (
    <AppShell>
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    </AppShell>
  );
};

export default AuthWrapper;
