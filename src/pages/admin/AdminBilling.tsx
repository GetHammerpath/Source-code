import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionStats {
  total: number;
  active: number;
  past_due: number;
  canceled: number;
}

interface StripeEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  status: string;
  processed_at: string | null;
  error_message: string | null;
}

const AdminBilling = () => {
  const { toast } = useToast();
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch subscription stats
      const { data: subscriptions, error: subError } = await supabase
        .from("subscriptions")
        .select("status");

      if (subError) throw subError;

      const stats: SubscriptionStats = {
        total: subscriptions?.length || 0,
        active: subscriptions?.filter((s) => s.status === "active").length || 0,
        past_due: subscriptions?.filter((s) => s.status === "past_due").length || 0,
        canceled: subscriptions?.filter((s) => s.status === "canceled").length || 0,
      };

      setSubscriptionStats(stats);

      // Fetch recent Stripe events
      const { data: events, error: eventsError } = await supabase
        .from("stripe_event_log")
        .select("*")
        .order("processed_at", { ascending: false })
        .limit(50);

      if (eventsError) throw eventsError;
      setRecentEvents(events || []);
    } catch (error: any) {
      console.error("Error fetching billing data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch billing data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <Badge variant="default">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Processed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Billing"
          subtitle="Monitor Stripe webhooks and billing health"
        />

        {/* Subscription Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionStats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {subscriptionStats?.active || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Past Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {subscriptionStats?.past_due || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Canceled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {subscriptionStats?.canceled || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stripe Event Log */}
        <Card>
          <CardHeader>
            <CardTitle>Stripe Webhook Events</CardTitle>
            <CardDescription>Recent webhook processing status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Stripe Event ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed At</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No webhook events found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge variant="outline">{event.event_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {event.stripe_event_id.substring(0, 20)}...
                        </TableCell>
                        <TableCell>{getStatusBadge(event.status)}</TableCell>
                        <TableCell>
                          {event.processed_at
                            ? format(new Date(event.processed_at), "MMM d, yyyy HH:mm:ss")
                            : "N/A"}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {event.error_message ? (
                            <div className="flex items-center text-red-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              <span className="truncate">{event.error_message}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Webhook Health */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Health</CardTitle>
            <CardDescription>Monitor webhook processing reliability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Last 24 Hours</span>
                <div className="flex items-center gap-2">
                  {recentEvents.filter((e) => e.status === "processed").length > 0 && (
                    <Badge variant="default">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Healthy
                    </Badge>
                  )}
                  {recentEvents.filter((e) => e.status === "failed").length > 0 && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {recentEvents.filter((e) => e.status === "failed").length} Failed
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Processed: {recentEvents.filter((e) => e.status === "processed").length} | Failed:{" "}
                {recentEvents.filter((e) => e.status === "failed").length} | Pending:{" "}
                {recentEvents.filter((e) => e.status === "pending").length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBilling;
