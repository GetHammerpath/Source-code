import { LayoutDashboard, LogOut, Video, Users, FileText, Scissors, Server, Terminal, CreditCard, Shield, Wallet, User, Loader2, Zap } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { role, canManageUsers, isAdmin, refreshRole } = useUserRole();
  const [togglingRole, setTogglingRole] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Check if we're in admin context
  const isAdminContext = location.pathname.startsWith("/admin");

  // Get user email to check if they're mershard@icloud.com
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null);
    });
  }, []);
  
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

  const handleToggleRole = async () => {
    setTogglingRole(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-toggle-role');

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newRole = data?.role;
      toast({
        title: "Success",
        description: `Switched to ${newRole === 'admin' ? 'admin' : 'user'} view`,
      });

      // Refresh role and navigate
      await refreshRole();
      
      // Navigate based on new role
      if (newRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error toggling role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to toggle role",
        variant: "destructive",
      });
    } finally {
      setTogglingRole(false);
    }
  };

  // Mandatory Sidebar Structure: Production, Assets, System
  const productionItems = [
    { to: "/create-avatar", icon: Users, label: "Casting" },
    { to: "/video-generator", icon: Scissors, label: "Studio" },
    { to: "/bulk", icon: Server, label: "Bulk Studio" },
  ];
  const assetsItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];
  const systemItems = [
    { to: "/api-keys", icon: Terminal, label: "API Keys" },
    { to: "/account/billing", icon: CreditCard, label: "Usage & Billing" },
  ];

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 ${
      isActive ? "bg-[#002FA7] text-white font-medium shadow-sm" : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img src="/images/suosuo_logo.png" alt="Suosuo" className="h-10 w-10 object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight truncate">Suosuo</h1>
            <p className="text-xs text-slate-500 mt-0.5">Production Hub</p>
          </div>
        </div>
        {role && (
          <Badge variant="outline" className="mt-3 capitalize text-xs font-medium border-slate-200 text-slate-600">
            {role}
          </Badge>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {isAdminContext && canManageUsers ? (
          <div className="space-y-1">
            {adminNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/admin"} className={({ isActive }) => linkClass(isActive)}>
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Production</p>
              {productionItems.map((item) => (
                <NavLink key={item.to + item.label} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="space-y-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Assets</p>
              {assetsItems.map((item) => (
                <NavLink key={item.to + item.label} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="space-y-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">System</p>
              {systemItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}
            </div>

            {canManageUsers && (
              <div className="space-y-1 pt-4 border-t border-slate-200">
                <NavLink to="/admin" className={({ isActive }) => linkClass(isActive)}>
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">Admin</span>
                </NavLink>
              </div>
            )}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-2">
        {/* Role Toggle Button - Show for admins or mershard@icloud.com */}
        {(isAdmin || userEmail === 'mershard@icloud.com' || (role === null && isAdminContext)) && (
          <Button
            onClick={handleToggleRole}
            variant="outline"
            disabled={togglingRole}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/80 h-9 rounded-[14px] border-sidebar-border"
          >
            {togglingRole ? (
              <>
                <Loader2 className="h-4 w-4 mr-2.5 animate-spin" />
                <span className="text-sm">Switching...</span>
              </>
            ) : (
              <>
                {isAdmin ? (
                  <>
                    <User className="h-4 w-4 mr-2.5" />
                    <span className="text-sm">View as User</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2.5" />
                    <span className="text-sm">View as Admin</span>
                  </>
                )}
              </>
            )}
          </Button>
        )}
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
