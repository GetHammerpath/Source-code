import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, ExternalLink, Calendar, CreditCard } from "lucide-react";
import { useStudioAccess } from "@/hooks/useStudioAccess";
import { useCredits } from "@/hooks/useCredits";
import { STUDIO_ACCESS } from "@/lib/billing/pricing";
import { supabase } from "@/integrations/supabase/client";
import StudioHeader from "@/components/layout/StudioHeader";
import { format } from "date-fns";

interface CreditTransaction {
  id: string;
  type: "purchase" | "grant" | "debit" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  created_at: string;
  metadata: any;
}

const Billing = () => {
  const navigate = useNavigate();
  const { subscription, loading: subLoading } = useStudioAccess();
  const { balance, loading: creditsLoading } = useCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [creatingPortal, setCreatingPortal] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleManageSubscription = async () => {
    setCreatingPortal(true);
    try {
      const response = await supabase.functions.invoke("create-portal-session");
      if (response.error) throw response.error;

      const { url } = response.data;
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      alert("Failed to open customer portal. Please try again.");
      setCreatingPortal(false);
    }
  };

  const nextRenewal = subscription?.current_period_end
    ? format(new Date(subscription.current_period_end), "MMM d, yyyy")
    : null;

  return (
    <div className="h-full w-full bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-8">
        <StudioHeader
          title="Billing"
          subtitle="Manage your Studio Access subscription and credit balance"
        />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Studio Access */}
          <Card className="rounded-[14px]">
            <CardHeader>
              <CardTitle>Studio Access</CardTitle>
              <CardDescription>Your subscription status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : subscription ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{STUDIO_ACCESS.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ${STUDIO_ACCESS.price}/month
                      </p>
                    </div>
                    <Badge
                      variant={subscription.status === "active" ? "default" : "secondary"}
                    >
                      {subscription.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Next renewal:</span>
                      <span className="font-medium">{nextRenewal}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Studio Access includes 0 credits. Credits are purchased separately.
                    </div>
                  </div>

                  <Button
                    onClick={handleManageSubscription}
                    disabled={creatingPortal}
                    variant="outline"
                    className="w-full rounded-[14px]"
                  >
                    {creatingPortal ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        Manage Studio Access
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No Studio Access subscription</p>
                  <Button
                    onClick={() => navigate("/checkout?mode=access")}
                    className="rounded-[14px]"
                  >
                    Subscribe to Studio Access
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Balance */}
          <Card className="rounded-[14px]">
            <CardHeader>
              <CardTitle>Credit Balance</CardTitle>
              <CardDescription>Available credits for video rendering</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {creditsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="text-center py-6">
                    <div className="text-5xl font-bold text-primary mb-2">
                      {balance?.credits.toLocaleString() || "0"}
                    </div>
                    <p className="text-sm text-muted-foreground">credits available</p>
                  </div>

                  <Button
                    onClick={() => navigate("/checkout?mode=credits")}
                    className="w-full rounded-[14px]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Buy Credits
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Credit Ledger */}
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle>Credit Transaction History</CardTitle>
            <CardDescription>Recent credit purchases, usage, and refunds</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.type === "grant" || tx.type === "purchase"
                              ? "default"
                              : tx.type === "debit"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={tx.amount > 0 ? "text-green-600" : "text-red-600"}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} credits
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.balance_after.toLocaleString()} credits
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Billing;
