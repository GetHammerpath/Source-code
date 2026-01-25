import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalCredits: number;
  totalVideoJobs: number;
}

const AdminOverview = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await loadStats();
    } catch (error: any) {
      console.error("Error loading admin overview:", error);
      toast({
        title: "Error",
        description: "Failed to load admin overview data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: subCount } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { data: balances } = await supabase
        .from("credit_balance")
        .select("credits");

      const totalCredits = balances?.reduce((sum, b) => sum + (b.credits || 0), 0) || 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: jobCount } = await supabase
        .from("video_jobs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      setStats({
        totalUsers: userCount || 0,
        activeSubscriptions: subCount || 0,
        totalCredits,
        totalVideoJobs: jobCount || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Overview"
          subtitle="Platform health and key metrics"
        />

        {/* Dashboard Stats - Compact */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="rounded-[10px] border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Total Users</div>
              <div className="text-2xl font-semibold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          <Card className="rounded-[10px] border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Active Subscriptions</div>
              <div className="text-2xl font-semibold">{stats?.activeSubscriptions || 0}</div>
            </CardContent>
          </Card>
          <Card className="rounded-[10px] border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Total Credits</div>
              <div className="text-2xl font-semibold">{(stats?.totalCredits || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="rounded-[10px] border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Video Jobs (30d)</div>
              <div className="text-2xl font-semibold">{stats?.totalVideoJobs || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links - Compact */}
        <div className="grid md:grid-cols-3 gap-3">
          <Link to="/admin/users">
            <Card className="rounded-[10px] border hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="text-sm font-medium">Users</div>
                <div className="text-xs text-muted-foreground mt-0.5">Manage users and roles</div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/providers">
            <Card className="rounded-[10px] border hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="text-sm font-medium">Providers</div>
                <div className="text-xs text-muted-foreground mt-0.5">Configure providers</div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/billing">
            <Card className="rounded-[10px] border hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="text-sm font-medium">Billing</div>
                <div className="text-xs text-muted-foreground mt-0.5">Monitor webhooks</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
