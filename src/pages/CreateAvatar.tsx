import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStudioAccess } from "@/hooks/useStudioAccess";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { buildPrompts } from "@/lib/nano-banana-prompt-builder";

const CreateAvatar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscription, loading: subLoading, hasAccess } = useStudioAccess();

  const [castingPrompt, setCastingPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [talentName, setTalentName] = useState("");
  const [saving, setSaving] = useState(false);

  const [positivePrompt, setPositivePrompt] = useState("");
  const [editedPositivePrompt, setEditedPositivePrompt] = useState("");

  const canGenerate = castingPrompt.trim().length > 0 && !generating;
  const canSave = !!selectedImageUrl && talentName.trim().length > 0;

  useEffect(() => {
    if (castingPrompt.trim()) {
      const { positive } = buildPrompts(castingPrompt.trim());
      setPositivePrompt(positive);
      setEditedPositivePrompt(positive);
    } else {
      setPositivePrompt("");
      setEditedPositivePrompt("");
    }
  }, [castingPrompt]);

  const generateAvatars = async () => {
    setGenerateError(null);
    setGenerateNotice(null);
    setGenerating(true);
    setGeneratedUrls([]);
    try {
      const promptToUse = editedPositivePrompt.trim() || positivePrompt.trim() || castingPrompt.trim();
      const res = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToUse }),
      });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string; warning?: string };
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      const urls = Array.isArray(data?.urls) ? data.urls.filter(Boolean) : [];
      if (urls.length === 0) throw new Error("No images returned");
      if (data?.warning) setGenerateNotice(data.warning);
      setGeneratedUrls(urls.slice(0, 4));
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate images");
    } finally {
      setGenerating(false);
    }
  };

  const onPickImage = (url: string) => {
    setSelectedImageUrl(url);
    setTalentName("");
    setNameDialogOpen(true);
  };

  const handleSaveAvatar = async () => {
    if (!canSave || !selectedImageUrl) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("avatars").insert({
        user_id: user.id,
        name: talentName.trim(),
        seed_image_url: selectedImageUrl,
        voice_id: null,
      });
      if (error) throw error;
      toast({ title: "Avatar created", description: `"${talentName.trim()}" was added to your dashboard.` });
      setNameDialogOpen(false);
      navigate("/dashboard");
    } catch (e) {
      toast({
        title: "Failed to save",
        description: e instanceof Error ? e.message : "Could not create avatar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Dashboard
        </Button>
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-100">
                <Lock className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <CardTitle>Create avatars with Studio Access</CardTitle>
                <CardDescription>
                  Avatar creation is included with a Studio Access subscription. Subscribe to create and manage avatars from your dashboard.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              {subscription ? "Your subscription is not active. Update your plan to create avatars." : "Get Studio Access to unlock avatar creation and the full studio."}
            </p>
            <Button onClick={() => navigate("/checkout?mode=access")} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md">
              Get Studio Access
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Dashboard
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create new avatar</h1>
        <p className="text-sm text-slate-600 mt-1">Describe your spokesperson, generate options, then save one to your dashboard.</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Describe your spokesperson</CardTitle>
          <CardDescription>Use a short description (e.g. &quot;black cowboy&quot;, &quot;female chef&quot;). The prompt builder will fill in details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={castingPrompt}
              onChange={(e) => setCastingPrompt(e.target.value)}
              placeholder="e.g. photorealistic portrait, professional headshot..."
              className="rounded-md h-10"
            />
            <Button onClick={generateAvatars} disabled={!canGenerate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md h-10 px-6">
              {generating ? "Generating..." : "Generate"}
            </Button>
          </div>
          {generateError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{generateError}</div>
          )}
          {generateNotice && !generateError && (
            <div className={`text-xs p-2 rounded-md border ${generateNotice.includes("placeholder") ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
              {generateNotice}
            </div>
          )}

          {generatedUrls.length > 0 && (
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Pick an avatar</Label>
              <div className="grid grid-cols-2 gap-3">
                {generatedUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onPickImage(url)}
                    className="overflow-hidden rounded-md border border-slate-200 hover:shadow-md transition-all"
                  >
                    <img src={url} alt="Option" className="h-32 w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="rounded-md">
          <DialogHeader>
            <DialogTitle>Name your avatar</DialogTitle>
            <DialogDescription>This name will appear on your dashboard and in the workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedImageUrl && (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <img src={selectedImageUrl} alt="Selected" className="w-full h-48 object-cover" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="talent-name">Avatar name</Label>
              <Input
                id="talent-name"
                value={talentName}
                onChange={(e) => setTalentName(e.target.value)}
                placeholder="e.g. Mike"
                className="rounded-md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-md" disabled={!canSave} onClick={handleSaveAvatar}>
              {saving ? "Saving..." : "Save avatar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateAvatar;
