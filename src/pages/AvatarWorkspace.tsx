import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Play, Upload } from "lucide-react";
import VideoGenerationCard from "@/components/video-generator/VideoGenerationCard";

type AvatarRow = {
  id: string;
  user_id: string;
  name: string;
  seed_image_url: string;
  voice_id: string | null;
  created_at: string;
};

type CsvRow = Record<string, string>;

function parseCsvSimple(text: string): CsvRow[] {
  // Minimal CSV parser: supports commas, trims whitespace. For complex CSV (quotes/newlines),
  // we'll upgrade later.
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

export default function AvatarWorkspace() {
  const { id } = useParams();
  const avatarId = id || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [avatar, setAvatar] = useState<AvatarRow | null>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(true);

  // Director tools
  const [scriptPrompt, setScriptPrompt] = useState("");
  const [tone, setTone] = useState("happy");
  const [background, setBackground] = useState("studio");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);

  // Bulk mode (Golden Sample)
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<"idle" | "locked" | "approved" | "running" | "done">("idle");
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [showSampleReady, setShowSampleReady] = useState(false);

  const canGenerate = scriptPrompt.trim().length > 0 && !!avatar && !generating;

  const promptText = useMemo(() => {
    const toneText =
      tone === "happy"
        ? "Happy, upbeat, friendly"
        : tone === "serious"
          ? "Serious, confident, professional"
          : "Whisper, calm, intimate";

    const backgroundText =
      background === "studio" ? "Clean studio background" : background === "office" ? "Professional office background" : "Background provided by user upload";

    // If CSV rows include per-row fields later, we'll override these for each row.
    return `TONE: ${toneText}\nBACKGROUND: ${backgroundText}\n\n${scriptPrompt.trim()}`;
  }, [tone, background, scriptPrompt]);

  useEffect(() => {
    const run = async () => {
      if (!avatarId) {
        toast({ title: "Missing avatar id", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        const { data, error } = await supabase
          .from("avatars")
          .select("*")
          .eq("id", avatarId)
          .single();

        if (error) throw error;
        setAvatar(data as any);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e?.message || "Failed to load avatar",
          variant: "destructive",
        });
        navigate("/dashboard");
      } finally {
        setLoadingAvatar(false);
      }
    };
    run();
  }, [avatarId, navigate, toast]);

  useEffect(() => {
    const fetch = async () => {
      setLoadingGenerations(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from("kie_video_generations")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        const filtered = (data || []).filter((g: any) => {
          const meta = g?.metadata && typeof g.metadata === "object" ? g.metadata : null;
          const byMeta = meta && (meta as any).avatar_id === avatarId;
          const byImage = avatar?.seed_image_url && g.image_url === avatar.seed_image_url;
          const byName = avatar?.name && g.avatar_name === avatar.name;
          return byMeta || byImage || byName;
        });
        setGenerations(filtered);
      } catch (e) {
        console.warn("Failed to load generations:", e);
      } finally {
        setLoadingGenerations(false);
      }
    };
    if (avatarId) fetch();
  }, [avatarId, avatar?.seed_image_url, avatar?.name]);

  const startSingleVideo = async (opts?: { silent?: boolean }) => {
    if (!avatar) return;
    if (!scriptPrompt.trim()) {
      toast({ title: "Missing script", description: "Enter a script to generate.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Create a generation row first (the Edge Function expects generation_id)
      const { data: genRow, error: insertErr } = await supabase
        .from("kie_video_generations")
        .insert({
          user_id: session.user.id,
          // Kie frequently rejects arbitrary reference images with PUBLIC_ERROR_IP_INPUT_IMAGE.
          // For the Avatar Workspace MVP, generate via TEXT_2_VIDEO (no input image),
          // while still linking the avatar via metadata.
          image_url: "text-to-video",
          industry: "avatar",
          avatar_name: avatar.name,
          city: "—",
          model: "veo3_fast",
          aspect_ratio: "16:9",
          initial_status: "pending",
          metadata: {
            avatar_id: avatar.id,
            workspace: true,
            tone,
            background,
            background_file_name: backgroundFile?.name ?? null,
          },
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !anonKey) throw new Error("Missing Supabase config");

      const res = await fetch(`${supabaseUrl}/functions/v1/kie-generate-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          generation_id: genRow.id,
          prompt: promptText,
          image_url: "text-to-video",
          avatar_name: avatar.name,
          industry: "avatar",
          script: scriptPrompt.trim(),
          aspect_ratio: "16:9",
          generation_type: "TEXT_2_VIDEO",
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw: raw.slice(0, 200) };
      }

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Generation failed (${res.status})`);
      }

      if (!opts?.silent) {
        toast({ title: "Queued", description: "Video generation started." });
      }

      // Refresh list
      setGenerations((prev) => [{ id: genRow.id, ...data, created_at: new Date().toISOString() }, ...prev]);
    } catch (e: any) {
      toast({
        title: "Generation failed",
        description: e?.message || "Failed to start generation",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCsvUpload = async (file: File) => {
    setCsvFileName(file.name);
    const text = await file.text();
    const rows = parseCsvSimple(text);
    setCsvRows(rows);
    setBulkStatus("locked");
    setBulkProgress({ done: 0, total: rows.length });
    setBatchId(null);

    if (rows.length === 0) {
      toast({ title: "Invalid CSV", description: "CSV must have a header row and at least 1 data row.", variant: "destructive" });
      return;
    }

    // Create Batch record (status: locked) + rows for traceability
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !avatar) throw new Error("Not signed in");

      const { data: batch, error: batchErr } = await supabase
        .from("avatar_batches")
        .insert({
          user_id: session.user.id,
          avatar_id: avatar.id,
          status: "locked",
          file_name: file.name,
          total_rows: rows.length,
          processed_rows: 0,
          metadata: { source: "avatar-workspace" },
        })
        .select("id")
        .single();

      if (batchErr) throw batchErr;
      setBatchId(batch.id);

      const rowInserts = rows.map((r, idx) => ({
        batch_id: batch.id,
        row_index: idx + 1,
        payload: r,
        status: "pending",
      }));

      const { error: rowsErr } = await supabase.from("avatar_batch_rows").insert(rowInserts);
      if (rowsErr) throw rowsErr;
    } catch (e: any) {
      toast({
        title: "Batch setup failed",
        description: e?.message || "Could not create batch records",
        variant: "destructive",
      });
      // Continue anyway (UI-only mode) so user isn't blocked.
    }

    // Golden Sample: generate ONLY row #1 as a video
    const first = rows[0];
    const rowScript = first.script || first.prompt || first.text || scriptPrompt || "";
    if (!rowScript.trim()) {
      toast({ title: "CSV missing script", description: "Include a 'script' column or type a default script above.", variant: "destructive" });
      return;
    }

    setScriptPrompt(rowScript);
    await startSingleVideo({ silent: true });
    setBulkProgress({ done: 1, total: rows.length });
    setShowSampleReady(true);
  };

  const approveAndRunRest = async () => {
    if (bulkStatus !== "locked") return;
    setBulkStatus("approved");
    toast({ title: "Approved", description: "Running remaining rows..." });
    setBulkStatus("running");

    // Persist approval to DB (if a batch was created)
    try {
      if (batchId) {
        await supabase.from("avatar_batches").update({ status: "running" }).eq("id", batchId);
      }
    } catch {
      // ignore
    }

    // Process rows 2..n sequentially (client-side for now)
    for (let i = 1; i < csvRows.length; i++) {
      const r = csvRows[i];
      const rowScript = r.script || r.prompt || r.text || "";
      if (!rowScript.trim()) {
        setBulkProgress((p) => ({ ...p, done: Math.min(p.done + 1, p.total) }));
        continue;
      }
      setScriptPrompt(rowScript);
      await startSingleVideo({ silent: true });
      setBulkProgress({ done: i + 1, total: csvRows.length });
    }

    setBulkStatus("done");
    try {
      if (batchId) {
        await supabase
          .from("avatar_batches")
          .update({ status: "completed", processed_rows: csvRows.length })
          .eq("id", batchId);
      }
    } catch {
      // ignore
    }
    toast({ title: "Done", description: "Bulk run completed." });
  };

  return (
    <div className="h-full w-full bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-8">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-6">
          <Button variant="ghost" className="rounded-md" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Avatar Workspace</h1>
            <p className="text-sm text-slate-600 mt-1">Direct your avatar and generate videos safely.</p>
          </div>
        </div>

        {loadingAvatar ? (
          <div className="text-sm text-slate-600">Loading avatar...</div>
        ) : !avatar ? (
          <div className="text-sm text-slate-600">Avatar not found.</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column: Avatar Preview */}
            <Card className="rounded-md border border-slate-200 shadow-sm overflow-hidden bg-white">
              <div className="h-96 bg-slate-50">
                <img src={avatar.seed_image_url} alt={avatar.name} className="h-96 w-full object-cover" />
              </div>
              <CardHeader>
                <CardTitle className="text-xl font-mono text-slate-900">{avatar.name}</CardTitle>
              </CardHeader>
            </Card>

            {/* Right Column: Director Tools */}
            <div className="space-y-6">
              <Card className="rounded-[14px] border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">The Director Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Script</Label>
                    <Textarea
                      value={scriptPrompt}
                      onChange={(e) => setScriptPrompt(e.target.value)}
                      placeholder="Write what the avatar should say and do..."
                      className="rounded-[14px] min-h-[140px]"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tone</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger className="rounded-[14px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="happy">Happy</SelectItem>
                          <SelectItem value="serious">Serious</SelectItem>
                          <SelectItem value="whisper">Whisper</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Background</Label>
                      <Select value={background} onValueChange={setBackground}>
                        <SelectTrigger className="rounded-[14px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="studio">Studio</SelectItem>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="upload">Upload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {background === "upload" && (
                    <div className="space-y-2">
                      <Label>Upload background</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept="image/*"
                          className="rounded-[14px]"
                          onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)}
                        />
                        <Button variant="outline" className="rounded-[14px]" disabled>
                          <Upload className="h-4 w-4 mr-2" />
                          Coming soon
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Upload support will be wired to storage next. For now it’s used as metadata only.
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    <Button
                      onClick={() => startSingleVideo()}
                      disabled={!canGenerate}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm"
                    >
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      Generate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-md border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">Bulk Upload (Golden Sample)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-md">
                      <TabsTrigger value="upload">Upload CSV</TabsTrigger>
                      <TabsTrigger value="status">Status</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="pt-4 space-y-3">
                      <div className="text-sm text-slate-600">
                        Upload a CSV. We will generate only row #1 first, then pause for approval.
                      </div>
                      <Input
                        type="file"
                        accept=".csv,text/csv"
                        className="rounded-md border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleCsvUpload(f);
                        }}
                      />
                      {csvFileName && (
                        <div className="text-xs text-slate-500">
                          Loaded: <span className="font-medium">{csvFileName}</span> ({csvRows.length} rows)
                        </div>
                      )}
                      {csvRows.length > 0 && (
                        <div className="mt-4 border border-slate-200 rounded-md overflow-hidden">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                {Object.keys(csvRows[0] || {}).map((header) => (
                                  <th key={header} className="text-left p-3 text-xs font-semibold text-slate-900">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvRows.slice(0, 5).map((row, i) => (
                                <tr key={i} className="border-b border-slate-200 last:border-b-0">
                                  {Object.values(row).map((cell, j) => (
                                    <td key={j} className="p-3 text-xs text-slate-600 font-mono">
                                      {String(cell).slice(0, 30)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {csvRows.length > 5 && (
                            <div className="p-3 text-xs text-slate-500 text-center bg-slate-50">
                              ... and {csvRows.length - 5} more rows
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="status" className="pt-4 space-y-3">
                      <div className="text-sm">
                        <span className="text-slate-600">Batch status:</span>{" "}
                        <span className="font-medium text-slate-900">{bulkStatus}</span>
                      </div>
                      {csvRows.length > 0 && (
                        <div className="text-sm text-slate-600">
                          Progress: {bulkProgress.done}/{bulkProgress.total}
                        </div>
                      )}
                      {showSampleReady && bulkStatus === "locked" && (
                        <Card className="rounded-md border border-slate-200 bg-slate-50">
                          <CardContent className="p-4 space-y-3">
                            <div className="font-semibold text-slate-900">Sample Ready</div>
                            <div className="text-sm text-slate-600">
                              Row #1 has been queued. Approve to run the rest.
                            </div>
                            <div className="flex justify-end">
                              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm" onClick={approveAndRunRest}>
                                Approve &amp; run remaining rows
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card className="rounded-md border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">Recent renders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingGenerations ? (
                    <div className="text-sm text-slate-600">Loading…</div>
                  ) : generations.length === 0 ? (
                    <div className="text-sm text-slate-600">No renders for this avatar yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {generations.map((g) => (
                        <VideoGenerationCard key={g.id} generation={g} onRefresh={() => {}} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

