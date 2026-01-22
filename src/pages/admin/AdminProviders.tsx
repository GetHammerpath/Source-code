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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings, AlertTriangle, Power, PowerOff, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { getAllProviderBalances, ProviderBalance } from "@/lib/admin/providerBalances";

interface ProviderSetting {
  id: string;
  provider: string;
  user_id: string | null;
  enabled: boolean;
  max_retries: number;
  timeout_seconds: number;
  max_duration_per_job: number;
  concurrency_limit: number;
  emergency_pause: boolean;
  updated_at: string;
}

const AdminProviders = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ProviderSetting[]>([]);
  const [providerBalances, setProviderBalances] = useState<ProviderBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<ProviderSetting | null>(null);
  const [editForm, setEditForm] = useState({
    enabled: true,
    max_retries: 3,
    timeout_seconds: 300,
    max_duration_per_job: 300,
    concurrency_limit: 5,
    emergency_pause: false,
  });
  const [editReason, setEditReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch provider settings (global only for now)
      const { data: settingsData, error: settingsError } = await supabase
        .from("provider_settings")
        .select("*")
        .is("user_id", null)
        .order("provider");

      if (settingsError) throw settingsError;
      setSettings(settingsData || []);

      // Fetch provider balances
      const balances = await getAllProviderBalances(false);
      setProviderBalances(balances);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch provider data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const handleToggleProvider = async (provider: string, enabled: boolean) => {
    if (!editReason) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this change",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("admin-update-provider-settings", {
        body: {
          provider,
          user_id: null, // Global setting
          enabled,
          reason: editReason,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Provider ${enabled ? "enabled" : "disabled"} successfully`,
      });

      setEditReason("");
      fetchData();
    } catch (error: any) {
      console.error("Error toggling provider:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update provider",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!selectedSetting || !editReason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("admin-update-provider-settings", {
        body: {
          provider: selectedSetting.provider,
          user_id: selectedSetting.user_id,
          enabled: editForm.enabled,
          settings: {
            max_retries: editForm.max_retries,
            timeout_seconds: editForm.timeout_seconds,
            max_duration_per_job: editForm.max_duration_per_job,
            concurrency_limit: editForm.concurrency_limit,
            emergency_pause: editForm.emergency_pause,
          },
          reason: editReason,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Provider settings updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedSetting(null);
      setEditReason("");
      fetchData();
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openEditDialog = (setting: ProviderSetting) => {
    setSelectedSetting(setting);
    setEditForm({
      enabled: setting.enabled,
      max_retries: setting.max_retries,
      timeout_seconds: setting.timeout_seconds,
      max_duration_per_job: setting.max_duration_per_job,
      concurrency_limit: setting.concurrency_limit,
      emergency_pause: setting.emergency_pause,
    });
    setEditDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Providers"
          subtitle="Manage video generation providers and settings"
          actions={
            <Button variant="outline" onClick={handleRefreshBalances} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Balances
            </Button>
          }
        />

        {/* Provider Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Account Balances</CardTitle>
            <CardDescription>Current balance for each provider account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providerBalances.map((balance) => (
                <div
                  key={balance.provider}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium capitalize">{balance.provider}</div>
                    <div className="text-sm text-muted-foreground">
                      {balance.balance_value.toLocaleString()} {balance.balance_unit}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Updated {format(new Date(balance.fetched_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  {balance.error_message && (
                    <Badge variant="destructive" className="ml-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Provider Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Settings</CardTitle>
            <CardDescription>Global provider configuration and controls</CardDescription>
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
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max Retries</TableHead>
                    <TableHead>Timeout (s)</TableHead>
                    <TableHead>Max Duration (s)</TableHead>
                    <TableHead>Concurrency</TableHead>
                    <TableHead>Emergency Pause</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No provider settings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    settings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell className="font-medium capitalize">{setting.provider}</TableCell>
                        <TableCell>
                          <Badge variant={setting.enabled ? "default" : "secondary"}>
                            {setting.enabled ? (
                              <>
                                <Power className="h-3 w-3 mr-1" />
                                Enabled
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3 mr-1" />
                                Disabled
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>{setting.max_retries}</TableCell>
                        <TableCell>{setting.timeout_seconds}</TableCell>
                        <TableCell>{setting.max_duration_per_job}</TableCell>
                        <TableCell>{setting.concurrency_limit}</TableCell>
                        <TableCell>
                          {setting.emergency_pause ? (
                            <Badge variant="destructive">Paused</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(setting)}
                            className="mr-2"
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Edit
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

        {/* Edit Settings Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Provider Settings</DialogTitle>
              <DialogDescription>
                Update provider configuration. All changes are logged and audited.
              </DialogDescription>
            </DialogHeader>
            {selectedSetting && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Provider Enabled</Label>
                  <Switch
                    checked={editForm.enabled}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, enabled: checked })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Max Retries</Label>
                    <Input
                      type="number"
                      value={editForm.max_retries}
                      onChange={(e) =>
                        setEditForm({ ...editForm, max_retries: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={editForm.timeout_seconds}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          timeout_seconds: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max Duration per Job (seconds)</Label>
                    <Input
                      type="number"
                      value={editForm.max_duration_per_job}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          max_duration_per_job: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Concurrency Limit</Label>
                    <Input
                      type="number"
                      value={editForm.concurrency_limit}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          concurrency_limit: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Emergency Pause</Label>
                    <p className="text-xs text-muted-foreground">
                      Pause all rendering for this provider
                    </p>
                  </div>
                  <Switch
                    checked={editForm.emergency_pause}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, emergency_pause: checked })
                    }
                  />
                </div>
                <div>
                  <Label>Reason (Required)</Label>
                  <Textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Explain why you're changing these settings..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSettings} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminProviders;
