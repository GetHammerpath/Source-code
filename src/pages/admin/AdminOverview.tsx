import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllProviderBalances, ProviderBalance } from "@/lib/admin/providerBalances";
import { format, formatDistanceToNow } from "date-fns";
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
  const [providerBalances, setProviderBalances] = useState<ProviderBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const balances = await getAllProviderBalances(false);
      setProviderBalances(balances);
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

  const handleRefreshBalances = async () => {
    setRefreshing(true);
    try {
      const balances = await getAllProviderBalances(true);
      setProviderBalances(balances);
      toast({
        title: "Success",
        description: "Provider balances refreshed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh balances",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Overview"
          subtitle="Platform health and provider status"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshBalances}
              disabled={refreshing || loading}
              className="h-8"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Refresh
                </>
              )}
            </Button>
          }
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

        {/* Provider Balances - Compact */}
        <Card className="rounded-[10px] border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Provider Balances</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {providerBalances.map((balance) => {
                  const isStale = balance.fetched_at
                    ? (Date.now() - new Date(balance.fetched_at).getTime()) > 10 * 60 * 1000
                    : true;
                  
                  return (
                    <div
                      key={balance.provider}
                      className="flex items-center justify-between p-3 rounded-[8px] border bg-muted/30"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium capitalize">{balance.provider}</span>
                          {balance.error_message ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                              Unavailable
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-semibold">
                          {balance.balance_value.toLocaleString()}{" "}
                          <span className="text-sm text-muted-foreground font-normal">
                            {balance.balance_unit}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {balance.fetched_at
                            ? `Updated ${formatDistanceToNow(new Date(balance.fetched_at), { addSuffix: true })}`
                            : "Never updated"}
                          {isStale && !balance.error_message && (
                            <span className="ml-2 text-amber-600">• Stale</span>
                          )}
                        </div>
                        {balance.error_message && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {balance.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
