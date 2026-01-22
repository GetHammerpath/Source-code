import { LayoutDashboard, Plus, LogOut, Video, Users, FileText, Wand2, Sparkles, Zap, Film, Layers, Shuffle, Database, CreditCard, Shield, Wallet } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { role, canManageUsers } = useUserRole();
  
  // Check if we're in admin context
  const isAdminContext = location.pathname.startsWith("/admin");
  
  // Admin navigation items
  const adminNavItems = [
    { to: "/admin", icon: LayoutDashboard, label: "Overview" },
    { to: "/admin/users", icon: Users, label: "Users" },
    { to: "/admin/credits", icon: CreditCard, label: "Credits" },
    { to: "/admin/providers", icon: Zap, label: "Providers" },
    { to: "/admin/billing", icon: Wallet, label: "Billing" },
    { to: "/admin/renders", icon: Video, label: "Renders" },
    { to: "/admin/audit", icon: FileText, label: "Audit Log" },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

      const navItems = [
        { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/long-form", icon: Film, label: "Long-Form Generator", premium: true },
        { to: "/video-generator", icon: Wand2, label: "AI Video (Veo)" },
        // { to: "/sora-storyboard-generator", icon: Sparkles, label: "Sora 2 Pro", premium: true },
        // { to: "/sora2-latest", icon: Zap, label: "Sora 2 Latest", premium: true },
        { to: "/bulk-video", icon: Layers, label: "Bulk Video", premium: true },
        { to: "/smart-bulk", icon: Shuffle, label: "Smart Bulk", premium: true },
        { to: "/assets", icon: Database, label: "Asset Library", premium: true },
        { to: "/account/billing", icon: CreditCard, label: "Billing & Credits" },
        // { to: "/runway-extend", icon: Film, label: "Runway Extend", premium: true }
      ];


  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[14px] bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
            <Video className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-sidebar-foreground tracking-tight">Video Portal</h1>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">Production Hub</p>
          </div>
        </div>
        {role && (
          <Badge variant="outline" className="mt-4 capitalize text-xs font-medium">
            {role}
          </Badge>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {isAdminContext && canManageUsers ? (
          // Show admin nav items when in admin context
          <div className="space-y-1">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-[10px] transition-all duration-150 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ) : (
          // Show regular nav items
          <>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-[10px] transition-all duration-150 ${
                      (item as any).premium ? "bg-gradient-to-r from-amber-500/8 to-orange-500/8 " : ""
                    }${
                      isActive
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/80"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}
            </div>

            {canManageUsers && (
              <div className="space-y-1 mt-4 pt-4 border-t border-sidebar-border">
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-[10px] transition-all duration-150 ${
                      isActive
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/80"
                    }`
                  }
                >
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Admin</span>
                </NavLink>
              </div>
            )}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/80 h-9 rounded-[14px]"
        >
          <LogOut className="h-4 w-4 mr-2.5" />
          <span className="text-sm">Log Out</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
