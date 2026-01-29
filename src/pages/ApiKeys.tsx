import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Plus, Copy, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import StudioHeader from "@/components/layout/StudioHeader";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

const ApiKeys = () => {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const { toast } = useToast();

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-keys", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.keys)) {
        setKeys(data.keys);
      } else {
        setKeys([]);
      }
    } catch (e) {
      toast({
        title: "Failed to load API keys",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    const name = createName.trim() || "API Key";
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-keys", {
        body: { action: "create", name },
      });
      if (error) throw error;
      if (data?.success && data.key) {
        setNewKey(data.key);
        setCreateName("");
        setCreateOpen(false);
        await fetchKeys();
      } else {
        throw new Error(data?.error ?? "Failed to create key");
      }
    } catch (e) {
      toast({
        title: "Create failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-keys", {
        body: { action: "revoke", id: revokeId },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Key revoked" });
        setRevokeId(null);
        await fetchKeys();
      } else {
        throw new Error(data?.error ?? "Failed to revoke");
      }
    } catch (e) {
      toast({
        title: "Revoke failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied", description: `${label} copied to clipboard.` }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return s;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <StudioHeader />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <p className="text-sm text-slate-600 mt-1">
          Create and manage API keys to access the platform programmatically (video generation, credits, etc.).
        </p>

        {/* How to use the API — Stripe Docs style: two-column (Explanation left, Code right) */}
        <div className="api-docs mt-8">
          <Card className="rounded-md border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">How to serve this app via API</CardTitle>
              <CardDescription className="text-slate-600">
                Use an API key to call duidui programmatically. Credits are deducted from your account. Your admin can revoke API access from the admin panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-0 border-t border-slate-200">
                <div className="p-6 space-y-6 text-sm bg-white">
                  <div>
                    <p className="font-medium text-slate-900 mb-1">1. Base URL</p>
                    <p className="text-slate-600">
                      Use your Supabase project URL plus <code className="font-mono bg-slate-100 px-1 rounded text-xs">/functions/v1/</code>. Find it in Supabase Dashboard → Project Settings → API, or in your app env as <code className="font-mono bg-slate-100 px-1 rounded text-xs">VITE_SUPABASE_URL</code>.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">2. Authentication</p>
                    <p className="text-slate-600">
                      Send your API key in the <code className="font-mono bg-slate-100 px-1 rounded text-xs">Authorization</code> header as <code className="font-mono bg-slate-100 px-1 rounded text-xs">Bearer &lt;your_key&gt;</code>. Also send the Supabase anon key in the <code className="font-mono bg-slate-100 px-1 rounded text-xs">apikey</code> header (required by Supabase Edge Functions).
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">3. Endpoints that accept API keys</p>
                    <p className="text-slate-600">
                      <strong>Video generation (Kie)</strong> — <code className="font-mono bg-slate-100 px-1 rounded text-xs">POST /functions/v1/kie-generate-video</code>. Body: <code className="font-mono text-xs">generation_id</code>, <code className="font-mono text-xs">prompt</code>, <code className="font-mono text-xs">image_url</code>, and optional <code className="font-mono text-xs">script</code>, <code className="font-mono text-xs">model</code>, <code className="font-mono text-xs">aspect_ratio</code>. The <code className="font-mono text-xs">generation_id</code> must reference an existing row in <code className="font-mono text-xs">kie_video_generations</code> for your user (create one via the Studio UI first, or use a future create endpoint).
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">4. Example request</p>
                    <p className="text-slate-600 text-xs mt-1">
                      Ensure your account has API access allowed (admins can revoke it). Credits are charged per use; check Usage & Billing for your balance.
                    </p>
                  </div>
                </div>
                <div className="p-6 bg-slate-900/5 border-l border-slate-200 space-y-4">
                  <pre className="font-mono p-4 bg-slate-900 text-slate-100 rounded-md text-xs overflow-x-auto border border-slate-200">
{`Authorization: Bearer duidui_xxxxxxxx...
apikey: <your Supabase anon/public key>`}
                  </pre>
                  <pre className="font-mono p-4 bg-slate-900 text-slate-100 rounded-md text-xs overflow-x-auto border border-slate-200">
{`curl -X POST "https://<project-ref>.supabase.co/functions/v1/kie-generate-video" \\
  -H "Authorization: Bearer duidui_YOUR_API_KEY" \\
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"generation_id":"<uuid>","prompt":"...","image_url":"https://..."}'`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-md border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Your API Keys
              </CardTitle>
              <CardDescription>
                Use keys as <code className="text-xs bg-slate-100 px-1 rounded">Authorization: Bearer duidui_xxx</code> when
                calling duidui (this platform). Credits are deducted from your account.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create key
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No API keys yet. Create one to get started.
              </p>
            ) : (
              keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">{k.name}</p>
                    <p className="font-mono text-sm text-slate-600 mt-1">{k.key_prefix}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Created {formatDate(k.created_at)}
                      {k.last_used_at ? ` · Last used ${formatDate(k.last_used_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Copy masked key"
                      onClick={() => copyToClipboard(k.key_prefix, "Key reference")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      title="Revoke"
                      onClick={() => setRevokeId(k.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Create key dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Give this key a name (e.g. &quot;Production&quot; or &quot;CI&quot;). The full key is shown only once
                after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input
                placeholder="e.g. Production API Key"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Show new key once */}
        <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this key now. It won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-slate-100 p-3 rounded break-all font-mono">
                {newKey}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => newKey && copyToClipboard(newKey, "API key")}
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKey(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke confirm */}
        <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
              <AlertDialogDescription>
                Any apps using this key will stop working. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-red-600 hover:bg-red-700"
              >
                {revoking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Revoking…
                  </>
                ) : (
                  "Revoke"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ApiKeys;
