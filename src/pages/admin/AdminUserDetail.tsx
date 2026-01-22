import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowLeft,
  Loader2,
  Calendar,
  CreditCard,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Ban,
  Check,
  UserX,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UserDetail {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  role: string;
  status: string;
  created_at: string;
  last_login: string | null;
  stripe_customer_id: string | null;
  subscription: {
    status: string;
    current_period_end: string;
    stripe_subscription_id: string;
  } | null;
  credit_balance: number;
}

const AdminUserDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (id) {
      fetchUserDetail();
      fetchLoginHistory();
      fetchCreditTransactions();
    }
  }, [id]);

  const fetchUserDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profileError) throw profileError;

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", id)
        .single();

      // Fetch user limits (status)
      const { data: limitsData } = await supabase
        .from("user_limits")
        .select("status")
        .eq("user_id", id)
        .single();

      // Fetch subscription
      const { data: subscriptionData } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, stripe_subscription_id")
        .eq("user_id", id)
        .eq("plan", "studio_access")
        .single();

      // Fetch credit balance
      const { data: balanceData } = await supabase
        .from("credit_balance")
        .select("credits")
        .eq("user_id", id)
        .single();

      setUser({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        email_verified: profile.email_verified || false,
        role: roleData?.role || "contributor",
        status: limitsData?.status || "active",
        created_at: profile.created_at,
        last_login: profile.last_login,
        stripe_customer_id: profile.stripe_customer_id,
        subscription: subscriptionData || null,
        credit_balance: balanceData?.credits || 0,
      });
    } catch (error: any) {
      console.error("Error fetching user detail:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch user details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginHistory = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("login_events")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLoginHistory(data || []);
    } catch (error: any) {
      console.error("Error fetching login history:", error);
    }
  };

  const fetchCreditTransactions = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setCreditTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching credit transactions:", error);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!id || !reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this action",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const oldRole = user?.role;
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", id);

      if (error) throw error;

      // Create audit log
      await supabase.functions.invoke("admin-audit-log", {
        body: {
          action_type: "role_change",
          target_type: "user",
          target_id: id,
          before_json: { role: oldRole },
          after_json: { role: newRole },
          reason,
        },
      });

      toast({
        title: "Success",
        description: `User role changed to ${newRole}`,
      });

      setShowRoleDialog(false);
      setReason("");
      fetchUserDetail();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change role",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!id || !reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for suspending this account",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const isSuspending = user?.status === "active";
      const newStatus = isSuspending ? "suspended" : "active";

      const { error } = await supabase
        .from("user_limits")
        .upsert({
          user_id: id,
          status: newStatus,
          suspended_reason: isSuspending ? reason : null,
          suspended_at: isSuspending ? new Date().toISOString() : null,
        });

      if (error) throw error;

      // Create audit log
      await supabase.functions.invoke("admin-audit-log", {
        body: {
          action_type: isSuspending ? "user_suspend" : "user_reactivate",
          target_type: "user",
          target_id: id,
          before_json: { status: user?.status },
          after_json: { status: newStatus },
          reason,
        },
      });

      toast({
        title: "Success",
        description: `User account ${newStatus === "suspended" ? "suspended" : "reactivated"}`,
      });

      setShowSuspendDialog(false);
      setReason("");
      fetchUserDetail();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update account status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!id || !reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for forcing password reset",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-force-password-reset", {
        body: { user_id: id, reason },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset email sent to user",
      });

      setShowPasswordResetDialog(false);
      setReason("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to force password reset",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvalidateSessions = async () => {
    if (!id || !reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for invalidating sessions",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-invalidate-sessions", {
        body: { user_id: id, reason },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "All user sessions invalidated",
      });

      setReason("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to invalidate sessions",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const failedLoginCount = loginHistory.filter((e) => !e.success).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">User not found</p>
          <Button onClick={() => navigate("/admin/users")} className="mt-4" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title={user.email}
          subtitle="User account details and management"
        />

        {/* Account Summary */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="rounded-[10px] border">
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{user.email}</div>
                  {user.email_verified ? (
                    <Badge variant="outline" className="mt-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 text-muted-foreground">
                      <XCircle className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Role</div>
                  <Badge variant="outline" className="capitalize mt-1">
                    {user.role}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant={user.status === "active" ? "default" : "destructive"}
                    className="mt-1"
                  >
                    {user.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="text-sm font-medium">
                    {format(new Date(user.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Security */}
          <Card className="rounded-[10px] border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Last Login</div>
                  <div className="text-sm font-medium">
                    {user.last_login
                      ? format(new Date(user.last_login), "MMM d, yyyy h:mm a")
                      : "Never"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Failed Login Attempts</div>
                  <div className="text-sm font-medium">{failedLoginCount}</div>
                  {failedLoginCount > 5 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>High Failure Count</AlertTitle>
                      <AlertDescription className="text-xs">
                        User has {failedLoginCount} failed login attempts
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="space-y-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordResetDialog(true)}
                    className="w-full rounded-[10px]"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Force Password Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInvalidateSessions}
                    className="w-full rounded-[10px]"
                    disabled={actionLoading}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Invalidate All Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>

          {/* Billing & Credits */}
          <Card className="rounded-[10px] border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Billing & Credits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Credit Balance</div>
                  <div className="text-2xl font-bold">{user.credit_balance.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Studio Access</div>
                  {user.subscription ? (
                    <>
                      <Badge
                        variant={
                          user.subscription.status === "active" ? "default" : "secondary"
                        }
                        className="mt-1 capitalize"
                      >
                        {user.subscription.status}
                      </Badge>
                      {user.subscription.current_period_end && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Renews {format(new Date(user.subscription.current_period_end), "MMM d, yyyy")}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No subscription</span>
                  )}
                </div>
                {user.stripe_customer_id && (
                  <div>
                    <div className="text-sm text-muted-foreground">Stripe Customer ID</div>
                    <div className="text-xs font-mono">{user.stripe_customer_id}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        {/* Admin Actions */}
        <Card className="rounded-[10px] border border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Admin Actions
              </CardTitle>
              <CardDescription>
                Actions require a reason and are audited
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-[10px]">
                      <Shield className="h-4 w-4 mr-2" />
                      Change Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[14px]">
                    <DialogHeader>
                      <DialogTitle>Change User Role</DialogTitle>
                      <DialogDescription>
                        Select new role for {user.email}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>New Role</Label>
                        <Select
                          defaultValue={user.role}
                          onValueChange={(value) => {
                            if (value !== user.role) {
                              handleRoleChange(value);
                            }
                          }}
                        >
                          <SelectTrigger className="rounded-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contributor">Contributor</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Reason *</Label>
                        <Textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Provide a reason for this role change..."
                          className="rounded-[10px]"
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRoleDialog(false);
                          setReason("");
                        }}
                        className="rounded-[10px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleRoleChange(user.role)}
                        disabled={actionLoading || !reason.trim()}
                        className="rounded-[10px]"
                      >
                        {actionLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Role"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant={user.status === "active" ? "destructive" : "default"}
                      className="rounded-[10px]"
                    >
                      {user.status === "active" ? (
                        <>
                          <Ban className="h-4 w-4 mr-2" />
                          Suspend Account
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Reactivate Account
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[14px]">
                    <DialogHeader>
                      <DialogTitle>
                        {user.status === "active" ? "Suspend Account" : "Reactivate Account"}
                      </DialogTitle>
                      <DialogDescription>
                        {user.status === "active"
                          ? "This will prevent the user from accessing the platform."
                          : "This will restore the user's access to the platform."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Reason *</Label>
                        <Textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Provide a reason for this action..."
                          className="rounded-[10px]"
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSuspendDialog(false);
                          setReason("");
                        }}
                        className="rounded-[10px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSuspend}
                        disabled={actionLoading || !reason.trim()}
                        variant={user.status === "active" ? "destructive" : "default"}
                        className="rounded-[10px]"
                      >
                        {actionLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : user.status === "active" ? (
                          "Suspend Account"
                        ) : (
                          "Reactivate Account"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-[10px]">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Force Password Reset
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[14px]">
                    <DialogHeader>
                      <DialogTitle>Force Password Reset</DialogTitle>
                      <DialogDescription>
                        This will send a password reset email to {user.email}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Reason *</Label>
                        <Textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Provide a reason for forcing password reset..."
                          className="rounded-[10px]"
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPasswordResetDialog(false);
                          setReason("");
                        }}
                        className="rounded-[10px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handlePasswordReset}
                        disabled={actionLoading || !reason.trim()}
                        className="rounded-[10px]"
                      >
                        {actionLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Reset Email"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

        {/* Login History */}
        <Card className="rounded-[10px] border">
            <CardHeader>
              <CardTitle>Login History</CardTitle>
              <CardDescription>Recent login attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {loginHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No login history available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>User Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginHistory.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-sm">
                          {format(new Date(event.created_at), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {event.ip_address || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {event.user_agent || "—"}
                        </TableCell>
                        <TableCell>
                          {event.success ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.failure_reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        {/* Credit Ledger */}
        <Card className="rounded-[10px] border">
            <CardHeader>
              <CardTitle>Credit Transaction History</CardTitle>
              <CardDescription>Recent credit purchases, usage, and adjustments</CardDescription>
            </CardHeader>
            <CardContent>
              {creditTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No credit transactions yet
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
                    {creditTransactions.map((tx) => (
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
    </AdminLayout>
  );
};

export default AdminUserDetail;
