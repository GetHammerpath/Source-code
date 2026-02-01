import * as React from "react";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Sparkles, RotateCw, Loader2 } from "lucide-react";
import { SmartTable, type BatchRow } from "./SmartTable";
import { ActionBar } from "./ActionBar";
import type { AvatarOption } from "./HybridAvatarSelector";

const createEmptyRow = (): BatchRow => ({
  id: uuid(),
  avatar_id: "",
  avatar_name: "",
  script: "",
  background: "",
  aspect_ratio: "16:9",
});

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface BatchWorkspaceProps {
  userId: string;
  baseConfig: {
    name: string;
    imageUrl: string | null;
    industry: string;
    city: string;
    storyIdea?: string;
    model: string;
    aspectRatio: string;
    numberOfScenes: number;
    generationType: "REFERENCE_2_VIDEO" | "TEXT_2_VIDEO";
  };
  onLaunch: (rows: BatchRow[], isTestRun: boolean) => Promise<void>;
  isSubmitting?: boolean;
}

export function BatchWorkspace({
  userId,
  baseConfig,
  onLaunch,
  isSubmitting = false,
}: BatchWorkspaceProps) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<BatchRow[]>([]);
  const [avatars, setAvatars] = React.useState<AvatarOption[]>([]);
  const [activeDoor, setActiveDoor] = React.useState<"csv" | "ai" | "spinner">("csv");
  const [selectedRowIndices, setSelectedRowIndices] = React.useState<Set<number>>(new Set());
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [spinnerScript, setSpinnerScript] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fetchAvatars = async () => {
      const { data } = await supabase
        .from("avatars")
        .select("id, name, seed_image_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setAvatars(data || []);
    };
    fetchAvatars();
  }, [userId]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data as Record<string, string>[];
        const mapped: BatchRow[] = parsed.map((p) => ({
          id: uuid(),
          avatar_id: p.avatar_id || p.avatar || "",
          avatar_name: p.avatar_name || p.avatar || p.name || "",
          script: p.script || p.prompt || "",
          background: p.background || "",
          aspect_ratio: p.aspect_ratio || p.aspectRatio || "16:9",
        }));
        setRows(mapped);
        toast({ title: "CSV loaded", description: `${mapped.length} rows imported` });
      },
      error: (err) => {
        toast({ title: "CSV error", description: err.message, variant: "destructive" });
      },
    });
    e.target.value = "";
  };

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast({ title: "Enter a campaign idea", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!url || !key || !session) throw new Error("Not authenticated");

      const res = await fetch(`${url}/functions/v1/analyze-image-kie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: key,
        },
        body: JSON.stringify({
          image_url: null,
          industry: baseConfig.industry,
          avatar_name: "Professional",
          city: baseConfig.city,
          story_idea: prompt,
          number_of_scenes: 1,
          generation_mode: "text",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI failed");

      const script = data.prompt || (data.scenes?.[0]?.prompt) || prompt;
      const generated: BatchRow[] = [
        { ...createEmptyRow(), script, avatar_name: "Auto-Cast: Professional", avatar_id: "__auto_professional__" },
        { ...createEmptyRow(), script, avatar_name: "Auto-Cast: Casual", avatar_id: "__auto_casual__" },
        { ...createEmptyRow(), script, avatar_name: "", avatar_id: "" },
      ];
      generated.forEach((r) => { r.id = uuid(); });
      setRows(generated);
      toast({ title: "AI generated", description: "3 template rows created" });
    } catch (err) {
      toast({
        title: "AI generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      const fallback: BatchRow[] = [
        { ...createEmptyRow(), script: prompt, avatar_name: "Auto-Cast: Professional", avatar_id: "__auto_professional__" },
        { ...createEmptyRow(), script: prompt, avatar_name: "Auto-Cast: Casual", avatar_id: "__auto_casual__" },
      ];
      fallback.forEach((r) => { r.id = uuid(); });
      setRows(fallback);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSpinnerGenerate = () => {
    const script = spinnerScript.trim();
    if (!script) {
      toast({ title: "Enter a script", variant: "destructive" });
      return;
    }
    if (avatars.length === 0) {
      toast({ title: "No avatars", description: "Create avatars first", variant: "destructive" });
      return;
    }
    const newRows: BatchRow[] = avatars.map((a) => ({
      id: uuid(),
      avatar_id: a.id,
      avatar_name: a.name,
      script,
      background: "",
      aspect_ratio: "16:9",
    }));
    setRows(newRows);
    toast({ title: "Spinner applied", description: `${newRows.length} rows (1 per avatar)` });
  };

  const handleFillDown = () => {
    const indices = Array.from(selectedRowIndices).sort((a, b) => a - b);
    if (indices.length === 0) {
      toast({ title: "Select rows first", variant: "destructive" });
      return;
    }
    const source = rows[indices[0]];
    const next = [...rows];
    indices.slice(1).forEach((i) => {
      next[i] = { ...next[i], avatar_id: source.avatar_id, avatar_name: source.avatar_name };
    });
    setRows(next);
    toast({ title: "Filled down", description: `Copied from row ${indices[0] + 1}` });
  };

  const handleAutoCastEmpty = () => {
    const opts = ["__auto_professional__", "__auto_casual__"];
    const next = rows.map((r) => {
      if (r.avatar_id || r.avatar_name) return r;
      const pick = opts[Math.floor(Math.random() * opts.length)];
      const name = pick === "__auto_professional__" ? "Auto-Cast: Professional" : "Auto-Cast: Casual";
      return { ...r, avatar_id: pick, avatar_name: name };
    });
    setRows(next);
    toast({ title: "Auto-Cast applied", description: "Empty avatar cells filled" });
  };

  const handleLaunch = async (isTestRun: boolean) => {
    const valid = rows.filter(
      (r) => r.script.trim() && (r.avatar_id || r.avatar_name) && r.script.length <= 500
    );
    if (valid.length === 0) {
      toast({ title: "No valid rows", description: "Add avatar and script to at least one row", variant: "destructive" });
      return;
    }
    await onLaunch(valid, isTestRun);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeDoor} onValueChange={(v) => setActiveDoor(v as "csv" | "ai" | "spinner")}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="csv" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload CSV
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Campaign
          </TabsTrigger>
          <TabsTrigger value="spinner" className="gap-2">
            <RotateCw className="h-4 w-4" />
            Spinner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload CSV</CardTitle>
              <p className="text-sm text-muted-foreground">
                CSV columns: avatar_id (or avatar), avatar_name, script (or prompt), background, aspect_ratio
              </p>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Campaign</CardTitle>
              <p className="text-sm text-muted-foreground">
                Describe your campaign idea. We&apos;ll generate template rows.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="e.g. Sell coffee to millennials"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-[80px]"
              />
              <Button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiLoading}
                className="gap-2"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spinner" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Spinner</CardTitle>
              <p className="text-sm text-muted-foreground">
                One script, all avatars. Creates a row per avatar.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label>Script</Label>
              <Textarea
                placeholder="Enter your script..."
                value={spinnerScript}
                onChange={(e) => setSpinnerScript(e.target.value)}
                className="min-h-[80px]"
              />
              <Button type="button" onClick={handleSpinnerGenerate} className="gap-2">
                <RotateCw className="h-4 w-4" />
                Apply to All Avatars ({avatars.length})
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Smart Table</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rows.length} rows. Edit cells, then submit.
          </p>
        </CardHeader>
        <CardContent>
          <SmartTable
            rows={rows}
            onChange={setRows}
            avatars={avatars}
            selectedRowIndices={selectedRowIndices}
            onSelectionChange={setSelectedRowIndices}
            onFillDown={handleFillDown}
            onAutoCastEmpty={handleAutoCastEmpty}
          />
        </CardContent>
      </Card>

      <ActionBar
        rows={rows}
        onLaunch={handleLaunch}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
