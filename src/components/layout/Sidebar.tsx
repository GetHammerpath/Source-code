import { LayoutDashboard, Plus, LogOut, Video, Users, FileText, Wand2, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

const Sidebar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, canManageUsers } = useUserRole();

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
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    // { to: "/new-request", icon: Plus, label: "New Request" },
    { to: "/video-generator", icon: Wand2, label: "AI Video (Veo)" },
    // { to: "/templates", icon: FileText, label: "Templates" },
  ];

  const adminNavItems = [
    { to: "/admin/users", icon: Users, label: "User Management" },
  ];

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Video className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-sidebar-foreground">Video Portal</h1>
            <p className="text-xs text-sidebar-foreground/70">Production Hub</p>
          </div>
        </div>
        {role && (
          <Badge variant="outline" className="mt-3 capitalize">
            {role}
          </Badge>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-6">
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  (item as any).premium ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 " : ""
                }${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {canManageUsers && (
          <div className="space-y-2">
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-sidebar-foreground/60 uppercase">Admin</p>
            </div>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-5 w-5 mr-3" />
          Log Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
