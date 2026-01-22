import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, Loader2, Wallet, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { createAuditLog } from "@/lib/admin/audit";

interface CreditBalance {
  user_id: string;
  email: string;
  full_name: string | null;
  credits: number;
  updated_at: string;
}

interface CreditTransaction {
  id: string;
  user_id: string;
  email: string;
  type: string;
  amount: number;
  balance_after: number;
  metadata: any;
  created_at: string;
}

const AdminCredits = () => {
  const { toast } = useToast();
  const [balances, setBalances] = useState<CreditBalance[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CreditBalance | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"adjustment" | "grant" | "debit">("adjustment");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch balances with user info
      const { data: balanceData, error: balanceError } = await supabase
        .from("credit_balance")
        .select(`
          user_id,
          credits,
          updated_at,
          profiles!inner(email, full_name)
        `)
        .order("credits", { ascending: false });

      if (balanceError) throw balanceError;

      const formattedBalances: CreditBalance[] = (balanceData || []).map((b: any) => ({
        user_id: b.user_id,
        email: b.profiles.email,
        full_name: b.profiles.full_name,
        credits: b.credits,
        updated_at: b.updated_at,
      }));

      setBalances(formattedBalances);

      // Fetch recent transactions
      const { data: transactionData, error: transactionError } = await supabase
        .from("credit_transactions")
        .select(`
          id,
          user_id,
          type,
          amount,
          balance_after,
          metadata,
          created_at,
          profiles!inner(email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (transactionError) throw transactionError;

      const formattedTransactions: CreditTransaction[] = (transactionData || []).map((t: any) => ({
        id: t.id,
        user_id: t.user_id,
        email: t.profiles.email,
        type: t.type,
        amount: t.amount,
        balance_after: t.balance_after,
        metadata: t.metadata,
        created_at: t.created_at,
      }));

      setTransactions(formattedTransactions);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch credit data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!selectedUser || !adjustmentAmount || !adjustmentReason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const amount = parseInt(adjustmentAmount);
    if (isNaN(amount) || amount === 0) {
      toast({
        title: "Validation Error",
        description: "Amount must be a non-zero number",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-adjust-credits", {
        body: {
          target_user_id: selectedUser.user_id,
          amount: adjustmentType === "debit" ? -Math.abs(amount) : Math.abs(amount),
          reason: adjustmentReason,
          type: adjustmentType,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Credits ${adjustmentType === "debit" ? "deducted" : "added"} successfully`,
      });

      setAdjustmentDialogOpen(false);
      setSelectedUser(null);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      fetchData();
    } catch (error: any) {
      console.error("Error adjusting credits:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to adjust credits",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalCredits = balances.reduce((sum, b) => sum + b.credits, 0);
  const totalUsers = balances.length;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Credits"
          subtitle="Manage user credits and adjustments"
          actions={
            <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adjust Credits
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust User Credits</DialogTitle>
                  <DialogDescription>
                    Add or remove credits from a user account. All adjustments are logged and audited.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>User</Label>
                    <Select
                      value={selectedUser?.user_id || ""}
                      onValueChange={(value) => {
                        const user = balances.find((b) => b.user_id === value);
                        setSelectedUser(user || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {balances.map((b) => (
                          <SelectItem key={b.user_id} value={b.user_id}>
                            {b.email} ({b.credits} credits)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Adjustment Type</Label>
                    <Select value={adjustmentType} onValueChange={(v: any) => setAdjustmentType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grant">Grant (Add Credits)</SelectItem>
                        <SelectItem value="debit">Debit (Remove Credits)</SelectItem>
                        <SelectItem value="adjustment">Adjustment (Set Amount)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div>
                    <Label>Reason (Required)</Label>
                    <Textarea
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Explain why you're adjusting credits..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAdjustment} disabled={processing}>
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Apply Adjustment"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCredits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">With credit balance</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalUsers > 0 ? Math.round(totalCredits / totalUsers).toLocaleString() : 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per user</p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Balances Table */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Balances</CardTitle>
            <CardDescription>Current credit balance for all users</CardDescription>
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
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No credit balances found
                      </TableCell>
                    </TableRow>
                  ) : (
                    balances.map((balance) => (
                      <TableRow key={balance.user_id}>
                        <TableCell>{balance.full_name || "N/A"}</TableCell>
                        <TableCell>{balance.email}</TableCell>
                        <TableCell className="text-right font-medium">
                          {balance.credits.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {format(new Date(balance.updated_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(balance);
                              setAdjustmentDialogOpen(true);
                            }}
                          >
                            Adjust
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transaction Ledger */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Ledger</CardTitle>
            <CardDescription>Recent credit transactions and adjustments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="grant">Grant</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{transaction.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.type}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {transaction.amount >= 0 ? "+" : ""}
                        {transaction.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.balance_after.toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.metadata?.reason || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCredits;
