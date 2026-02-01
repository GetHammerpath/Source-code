import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StrategyChoice } from "./Step1_Strategy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { BatchRow } from "@/types/bulk";
import { createEmptyRow, setSegments } from "@/types/bulk";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Step2_ConfigProps {
  strategy: StrategyChoice;
  config: Step2Config;
  onConfigChange: (updates: Partial<Step2Config>) => void;
  onRowsReady: (rows: BatchRow[]) => void;
}

export interface Step2Config {
  csvFile?: File | null;
  aiTopic?: string;
  aiTone?: string;
  aiSceneCount?: number;
  spinnerCount?: number;
  spinnerGender?: string;
  spinnerAge?: string;
  spinnerSceneCount?: number;
  spinnerSegment1?: string;
  spinnerSegment2?: string;
  spinnerSegment3?: string;
  spinnerSegment4?: string;
  spinnerSegment5?: string;
  sceneCount?: number; // shared 1-5, used by Workbench and Launch
}

const FIRST_MAX_WORDS = 20;  // 8 sec
const OTHER_MAX_WORDS = 17;  // 7 sec

export function Step2_Config({ strategy, config, onConfigChange, onRowsReady }: Step2_ConfigProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [checkingSegment, setCheckingSegment] = useState<number | null>(null);
  const [sampleScript, setSampleScript] = useState("");
  const [sampleSegmentType, setSampleSegmentType] = useState<"0" | "1">("0");
  const [sampleCheck, setSampleCheck] = useState<{ result: { wordCount: number; estimatedSeconds: number; fitsLimit: boolean; limitSeconds: number } } | null>(null);
  const [segmentCheckResults, setSegmentCheckResults] = useState<Record<number, { wordCount: number; estimatedSeconds: number; fitsLimit: boolean }>>({});

  if (!strategy) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 text-muted-foreground"
      >
        Go back and select a strategy first.
      </motion.div>
    );
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onConfigChange({ csvFile: file });
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data as Record<string, string>[];
        const rows: BatchRow[] = parsed.map((p) => {
          const r = createEmptyRow();
          r.id = uuid();
          r.avatar_id = p.avatar_id || p.avatar || "";
          r.avatar_name = p.avatar_name || p.avatar || p.name || "";
          const segs = [
            p.script || p.prompt || p.segment1 || "",
            p.segment2 || "",
            p.segment3 || "",
            p.segment4 || "",
            p.segment5 || "",
          ];
          Object.assign(r, setSegments(r, segs));
          return r;
        });
        onRowsReady(rows);
      },
    });
    e.target.value = "";
  };

  const handleAiGenerate = async () => {
    const topic = (config.aiTopic ?? "").trim();
    if (!topic) return;
    const sceneCount = Math.min(5, Math.max(1, config.aiSceneCount ?? config.sceneCount ?? 3));
    setAiLoading(true);
    try {
      const tone = config.aiTone ?? "professional";
      const avatarStyle = { professional: "Professional", casual: "Casual", friendly: "Friendly", energetic: "Energetic" }[tone] ?? "Professional";
      const { data, error } = await supabase.functions.invoke("analyze-image-kie", {
        body: {
          image_url: null,
          industry: "General",
          avatar_name: avatarStyle,
          city: "N/A",
          story_idea: topic,
          number_of_scenes: sceneCount,
          generation_mode: "text",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "AI generation failed");
      const r = createEmptyRow();
      r.id = uuid();
      r.avatar_id = tone === "casual" ? "__auto_casual__" : "__auto_professional__";
      r.avatar_name = tone === "casual" ? "Auto-Cast: Casual" : "Auto-Cast: Professional";
      if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
        const prompts: string[] = Array(sceneCount).fill("");
        data.scenes.forEach((s: { scene_number?: number; prompt?: string; script?: string }, i: number) => {
          const idx = (s.scene_number ?? i + 1) - 1;
          const text = s.prompt || s.script || "";
          if (idx >= 0 && idx < prompts.length) prompts[idx] = text;
          else prompts[i] = text;
        });
        Object.assign(r, setSegments(r, prompts));
      } else {
        const script = data.prompt ?? topic;
        const prompts: string[] = Array(sceneCount).fill(script);
        Object.assign(r, setSegments(r, prompts));
      }
      onConfigChange({ sceneCount });
      onRowsReady([r]);
    } catch (err) {
      console.error("AI script generation failed:", err);
      toast({
        title: "AI fallback",
        description: err instanceof Error ? err.message : "Using your topic as the script.",
        variant: "destructive",
      });
      const r = createEmptyRow();
      r.id = uuid();
      const prompts: string[] = Array(sceneCount).fill(topic);
      Object.assign(r, setSegments(r, prompts));
      r.avatar_id = "__auto_professional__";
      r.avatar_name = "Auto-Cast: Professional";
      onConfigChange({ sceneCount });
      onRowsReady([r]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSpinnerGenerate = async () => {
    const count = Math.max(10, Math.min(100, config.spinnerCount ?? 10));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: avatars } = await supabase
      .from("avatars")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = avatars || [];
    const sceneCount = Math.min(5, Math.max(1, config.spinnerSceneCount ?? config.sceneCount ?? 3));
    const segmentKeys = ["spinnerSegment1", "spinnerSegment2", "spinnerSegment3", "spinnerSegment4", "spinnerSegment5"] as const;
    const prompts: string[] = [];
    for (let i = 0; i < sceneCount; i++) {
      const val = (config as Record<string, string>)[segmentKeys[i]] ?? "";
      prompts.push(val.trim() || "Enter script...");
    }
    const rows: BatchRow[] = Array.from({ length: count }, () => {
      const r = createEmptyRow();
      r.id = uuid();
      if (list.length > 0) {
        const a = list[Math.floor(Math.random() * list.length)];
        r.avatar_id = a.id;
        r.avatar_name = a.name;
      } else {
        r.avatar_id = "__auto_professional__";
        r.avatar_name = "Auto-Cast: Professional";
      }
      const filled = [...prompts];
      while (filled.length < 5) filled.push("");
      Object.assign(r, setSegments(r, filled));
      return r;
    });
    onConfigChange({ sceneCount });
    onRowsReady(rows);
  };

  const validateScript = async (script: string, segmentIndex: number, trimIfOver: boolean) => {
    const { data, error } = await supabase.functions.invoke("validate-script-length", {
      body: { script, segmentIndex, trimIfOver },
    });
    if (error) throw error;
    return data;
  };

  const handleCheckSegment = async (segmentIndex: number) => {
    const key = `spinnerSegment${segmentIndex + 1}` as keyof Step2Config;
    const val = String((config[key] as string) ?? "").trim();
    if (!val) {
      toast({ title: "Enter a script first", variant: "destructive" });
      return;
    }
    setCheckingSegment(segmentIndex);
    setSegmentCheckResults((prev) => {
      const next = { ...prev };
      delete next[segmentIndex];
      return next;
    });
    try {
      const result = await validateScript(val, segmentIndex, false);
      if (result?.success) {
        setSegmentCheckResults((prev) => ({ ...prev, [segmentIndex]: result }));
        const ok = result.fitsLimit;
        toast({ title: ok ? "Script fits!" : `Over limit: ${result.wordCount} words (~${result.estimatedSeconds}s)`, variant: ok ? "default" : "destructive" });
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Check failed", variant: "destructive" });
    } finally {
      setCheckingSegment(null);
    }
  };

  const handleCheckSample = async () => {
    const val = sampleScript.trim();
    if (!val) {
      toast({ title: "Enter a script first", variant: "destructive" });
      return;
    }
    const segIdx = sampleSegmentType === "0" ? 0 : 1;
    setCheckingSegment(-1);
    setSampleCheck(null);
    try {
      const result = await validateScript(val, segIdx, false);
      if (result?.success) {
        setSampleCheck({ result });
        toast({ title: result.fitsLimit ? "Script fits!" : `Over: ${result.wordCount} words` });
      }
    } catch (err) {
      toast({ title: "Check failed", variant: "destructive" });
    } finally {
      setCheckingSegment(null);
    }
  };

  const handleTrimSegment = async (segmentIndex: number) => {
    const key = `spinnerSegment${segmentIndex + 1}` as keyof Step2Config;
    const val = String((config[key] as string) ?? "").trim();
    if (!val) return;
    setCheckingSegment(segmentIndex);
    try {
      const result = await validateScript(val, segmentIndex, true);
      if (result?.success && result.validatedScript) {
        onConfigChange({ [key]: result.validatedScript });
        toast({ title: "Script trimmed to fit", description: `${result.wordCount} words (~${result.estimatedSeconds}s)` });
        setSegmentCheckResults((prev) => ({ ...prev, [segmentIndex]: result }));
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Trim failed", variant: "destructive" });
    } finally {
      setCheckingSegment(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold mb-2">Setup your campaign</h2>
        <p className="text-muted-foreground">
          {strategy === "csv" && "Upload your CSV with scripts and avatar mappings."}
          {strategy === "ai" && "Describe your topic and tone. We'll generate a starting template."}
          {strategy === "spinner" && "Choose how many variations to create from your avatar library."}
        </p>
      </div>

      {strategy === "csv" && (
        <div className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>Number of scenes (1–5)</Label>
            <Select
              value={String(config.sceneCount ?? 3)}
              onValueChange={(v) => onConfigChange({ sceneCount: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} scene{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Drop your CSV here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                Columns: avatar_id, avatar_name, script (or segment1), segment2, segment3
              </p>
            </div>
            {config.csvFile && (
              <p className="text-sm text-primary font-medium">{config.csvFile.name}</p>
            )}
          </div>
        </div>
      )}

      {strategy === "ai" && (
        <div className="space-y-4 max-w-xl">
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <Label>Check sample script</Label>
            <p className="text-xs text-muted-foreground">
              Segment 1: 8 sec (~20 words). Segments 2+: 7 sec (~17 words).
            </p>
            <div className="flex gap-2 flex-wrap items-start">
              <Textarea
                placeholder="Paste a script to validate length..."
                value={sampleScript}
                onChange={(e) => { setSampleScript(e.target.value); setSampleCheck(null); }}
                className="min-h-[70px] text-sm flex-1 min-w-[200px]"
                rows={2}
              />
              <Select value={sampleSegmentType} onValueChange={(v: "0" | "1") => { setSampleSegmentType(v); setSampleCheck(null); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Segment 1 (8s)</SelectItem>
                  <SelectItem value="1">Segment 2+ (7s)</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={handleCheckSample} disabled={!sampleScript.trim() || checkingSegment !== null}>
                {checkingSegment === -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Check
              </Button>
            </div>
            {sampleCheck && (
              <p className={cn("text-sm mt-2 flex items-center gap-1.5", sampleCheck.result.fitsLimit ? "text-emerald-600" : "text-amber-600")}>
                {sampleCheck.result.fitsLimit ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {sampleCheck.result.wordCount} words, ~{sampleCheck.result.estimatedSeconds}s
                {sampleCheck.result.fitsLimit ? " ✓" : ` (max ${sampleCheck.result.limitSeconds}s)`}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Number of scenes (1–5)</Label>
            <Select
              value={String(config.aiSceneCount ?? config.sceneCount ?? 3)}
              onValueChange={(v) => onConfigChange({ aiSceneCount: Number(v), sceneCount: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} scene{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Script will populate across all scenes.</p>
          </div>
          <div className="space-y-2">
            <Label>Topic</Label>
            <Textarea
              placeholder="e.g. Sell coffee to millennials"
              value={config.aiTopic ?? ""}
              onChange={(e) => onConfigChange({ aiTopic: e.target.value })}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={config.aiTone ?? "professional"}
              onValueChange={(v) => onConfigChange({ aiTone: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="energetic">Energetic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={handleAiGenerate} disabled={!(config.aiTopic ?? "").trim() || aiLoading} className="gap-2">
            {aiLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Generating with ChatGPT...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Generate Template
              </>
            )}
          </Button>
        </div>
      )}

      {strategy === "spinner" && (
        <div className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Number of scenes (1–5)</Label>
            <Select
              value={String(config.spinnerSceneCount ?? config.sceneCount ?? 3)}
              onValueChange={(v) => onConfigChange({ spinnerSceneCount: Number(v), sceneCount: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} scene{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Number of rows (10–100)</Label>
            <Slider
              value={[config.spinnerCount ?? 10]}
              onValueChange={([v]) => onConfigChange({ spinnerCount: v })}
              min={10}
              max={100}
              step={1}
            />
            <p className="text-sm text-muted-foreground">{config.spinnerCount ?? 10} rows</p>
          </div>
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div>
              <Label>Check sample script</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Paste a script to validate length. Segment 1: 8 sec (~20 words). Segments 2+: 7 sec (~17 words).
              </p>
              <div className="flex gap-2 flex-wrap items-start">
                <Textarea
                  placeholder="Paste a script to check length..."
                  value={sampleScript}
                  onChange={(e) => { setSampleScript(e.target.value); setSampleCheck(null); }}
                  className="min-h-[70px] text-sm flex-1 min-w-[200px]"
                  rows={2}
                />
                <Select value={sampleSegmentType} onValueChange={(v: "0" | "1") => { setSampleSegmentType(v); setSampleCheck(null); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Segment 1 (8s)</SelectItem>
                    <SelectItem value="1">Segment 2+ (7s)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCheckSample}
                  disabled={!sampleScript.trim() || checkingSegment !== null}
                >
                  {checkingSegment === -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Check
                </Button>
              </div>
              {sampleCheck && (
                <p className={cn("text-sm mt-2 flex items-center gap-1.5", sampleCheck.result.fitsLimit ? "text-emerald-600" : "text-amber-600")}>
                  {sampleCheck.result.fitsLimit ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {sampleCheck.result.wordCount} words, ~{sampleCheck.result.estimatedSeconds}s
                  {sampleCheck.result.fitsLimit ? " ✓" : ` (max ${sampleCheck.result.limitSeconds}s)`}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Script per segment (optional)</Label>
            <p className="text-sm text-muted-foreground">
              Add a script for each scene. Segment 1: 8 sec (~20 words). Segments 2+: 7 sec (~17 words).
            </p>
            <div className="space-y-3">
              {Array.from({ length: Math.min(5, Math.max(1, config.spinnerSceneCount ?? config.sceneCount ?? 3)) }, (_, i) => {
                const key = `spinnerSegment${i + 1}` as keyof Step2Config;
                const val = (config[key] as string) ?? "";
                const maxWords = i === 0 ? FIRST_MAX_WORDS : OTHER_MAX_WORDS;
                const limitSec = i === 0 ? 8 : 7;
                const lastCheck = segmentCheckResults[i];
                return (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Segment {i + 1} — {limitSec}s (~{maxWords} words max)
                    </Label>
                    <Textarea
                      placeholder={`Script for scene ${i + 1}...`}
                      value={val}
                      onChange={(e) => {
                        onConfigChange({ [key]: e.target.value });
                        setSegmentCheckResults((p) => {
                          const next = { ...p };
                          delete next[i];
                          return next;
                        });
                      }}
                      className="min-h-[60px] text-sm resize-none"
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCheckSegment(i)}
                        disabled={!val.trim() || checkingSegment !== null}
                      >
                        {checkingSegment === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Check
                      </Button>
                      {lastCheck && !lastCheck.fitsLimit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-600"
                          onClick={() => handleTrimSegment(i)}
                          disabled={checkingSegment !== null}
                        >
                          Trim to fit
                        </Button>
                      )}
                      {lastCheck && (
                        <span className={cn("text-xs", lastCheck.fitsLimit ? "text-emerald-600" : "text-amber-600")}>
                          {lastCheck.wordCount} words, ~{lastCheck.estimatedSeconds}s
                          {lastCheck.fitsLimit ? " ✓" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender filter</Label>
              <Select
                value={config.spinnerGender ?? "any"}
                onValueChange={(v) => onConfigChange({ spinnerGender: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age filter</Label>
              <Select
                value={config.spinnerAge ?? "any"}
                onValueChange={(v) => onConfigChange({ spinnerAge: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="young">Young</SelectItem>
                  <SelectItem value="middle">Middle</SelectItem>
                  <SelectItem value="mature">Mature</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={handleSpinnerGenerate} className="gap-2">
            <Upload className="h-4 w-4" />
            Generate Rows
          </Button>
        </div>
      )}
    </motion.div>
  );
}
