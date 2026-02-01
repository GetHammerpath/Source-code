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
import { createEmptyRow, setSegments, SCENE_COUNT_MIN, SCENE_COUNT_MAX } from "@/types/bulk";
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
  existingRows?: BatchRow[];
  onConfigChange: (updates: Partial<Step2Config>) => void;
  onRowsReady: (rows: BatchRow[], opts?: { fromEstimateScenes?: boolean }) => void;
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
  sceneCount?: number; // shared, used by Workbench and Launch
}

const FIRST_MAX_WORDS = 20;  // 8 sec
const OTHER_MAX_WORDS = 17;  // 7 sec

export function Step2_Config({ strategy, config, existingRows = [], onConfigChange, onRowsReady }: Step2_ConfigProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [checkingSegment, setCheckingSegment] = useState<number | null>(null);
  const [sampleScript, setSampleScript] = useState("");
  const [sampleSegmentType, setSampleSegmentType] = useState<"0" | "1">("0");
  const [sampleCheck, setSampleCheck] = useState<{ result: { wordCount: number; estimatedSeconds: number; fitsLimit: boolean; limitSeconds: number } } | null>(null);
  const [sceneEstimate, setSceneEstimate] = useState<{ wordCount: number; sceneCount: number } | null>(null);

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
    const sceneCount = Math.min(SCENE_COUNT_MAX, Math.max(1, config.sceneCount ?? 3));
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
          const segs: string[] = [];
          for (let i = 0; i < sceneCount; i++) {
            if (i === 0) {
              segs.push(p.script || p.prompt || p.segment1 || "");
            } else {
              segs.push(p[`segment${i + 1}`] ?? "");
            }
          }
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
    const sceneCount = Math.min(SCENE_COUNT_MAX, Math.max(1, config.aiSceneCount ?? config.sceneCount ?? 3));
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
    let sceneCount = Math.min(SCENE_COUNT_MAX, Math.max(1, config.spinnerSceneCount ?? config.sceneCount ?? 3));
    let prompts: string[];
    if (sampleScript.trim()) {
      const parsed = parseScriptToSegments(sampleScript.trim());
      sceneCount = parsed.sceneCount;
      prompts = parsed.segments;
    } else {
      prompts = Array(sceneCount).fill("Enter script...");
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
      while (filled.length < sceneCount) filled.push("");
      Object.assign(r, setSegments(r, filled));
      return r;
    });
    onConfigChange({ spinnerSceneCount: sceneCount, sceneCount });
    onRowsReady(rows);
  };

  const validateScript = async (script: string, segmentIndex: number, trimIfOver: boolean) => {
    const { data, error } = await supabase.functions.invoke("validate-script-length", {
      body: { script, segmentIndex, trimIfOver },
    });
    if (error) throw error;
    return data;
  };

  const parseScriptToSegments = (script: string): { sceneCount: number; segments: string[] } => {
    const words = script.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const sceneCount = wordCount <= FIRST_MAX_WORDS ? 1 : 1 + Math.ceil((wordCount - FIRST_MAX_WORDS) / OTHER_MAX_WORDS);
    const segments: string[] = [];
    let idx = 0;
    for (let i = 0; i < sceneCount; i++) {
      const take = i === 0 ? FIRST_MAX_WORDS : OTHER_MAX_WORDS;
      segments.push(words.slice(idx, idx + take).join(" "));
      idx += take;
    }
    return { sceneCount, segments };
  };

  const handleEstimateScenes = () => {
    const val = sampleScript.trim();
    if (!val) {
      toast({ title: "Enter a script first", variant: "destructive" });
      return;
    }
    const { sceneCount, segments } = parseScriptToSegments(val);
    setSceneEstimate({ wordCount: val.split(/\s+/).filter(Boolean).length, sceneCount });
    setSampleCheck(null);
    onConfigChange(
      strategy === "ai"
        ? { aiSceneCount: sceneCount, sceneCount }
        : strategy === "spinner"
          ? { spinnerSceneCount: sceneCount, sceneCount }
          : { sceneCount }
    );
    // If we have existing rows (e.g. from Generate Rows), apply parsed segments to each
    if (existingRows.length > 0) {
      const updated = existingRows.map((row) => {
        const r = { ...row };
        Object.assign(r, setSegments(r, segments));
        return r;
      });
      onRowsReady(updated, { fromEstimateScenes: true });
    } else {
      const r = createEmptyRow();
      r.id = uuid();
      r.avatar_id = "__auto_professional__";
      r.avatar_name = "Auto-Cast: Professional";
      Object.assign(r, setSegments(r, segments));
      onRowsReady([r], { fromEstimateScenes: true });
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
    setSceneEstimate(null);
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
        <p className="text-xs text-muted-foreground mt-1">
          Scene 1: 8 sec (~20 words). Scenes 2+: 7 sec (~17 words each).
        </p>
      </div>

      {strategy === "csv" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <Label>CSV format requirements</Label>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li><strong>Required columns:</strong> <code className="text-xs bg-muted px-1 rounded">avatar_id</code> or <code className="text-xs bg-muted px-1 rounded">avatar</code>; <code className="text-xs bg-muted px-1 rounded">avatar_name</code> or <code className="text-xs bg-muted px-1 rounded">name</code></li>
              <li><strong>Script columns:</strong> <code className="text-xs bg-muted px-1 rounded">script</code> or <code className="text-xs bg-muted px-1 rounded">prompt</code> (for scene 1) and/or <code className="text-xs bg-muted px-1 rounded">segment1</code>, <code className="text-xs bg-muted px-1 rounded">segment2</code>, <code className="text-xs bg-muted px-1 rounded">segment3</code>, …</li>
              <li><strong>Word limits per scene:</strong> Scene 1 = 8 sec (~20 words max). Scenes 2+ = 7 sec each (~17 words max)</li>
              <li>First row must be a header with column names</li>
            </ul>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Number of scenes (1–{SCENE_COUNT_MAX.toLocaleString()})</Label>
            <Input
              type="number"
              min={SCENE_COUNT_MIN}
              max={SCENE_COUNT_MAX}
              value={config.sceneCount ?? 3}
              onChange={(e) => {
                const v = Math.min(SCENE_COUNT_MAX, Math.max(SCENE_COUNT_MIN, parseInt(e.target.value, 10) || 1));
                onConfigChange({ sceneCount: v });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Set this to match your CSV. Scene 1: 8 sec (~20 words). Scenes 2+: 7 sec (~17 words each).
            </p>
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
                Must include avatar columns and script/segment columns
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
          <p className="text-sm text-muted-foreground">
            Describe your topic and tone below. AI will generate the script for you—no script input needed.
          </p>
          <div className="space-y-2 max-w-xs">
            <Label>Number of scenes (1–{SCENE_COUNT_MAX.toLocaleString()})</Label>
            <Input
              type="number"
              min={SCENE_COUNT_MIN}
              max={SCENE_COUNT_MAX}
              value={config.aiSceneCount ?? config.sceneCount ?? 3}
              onChange={(e) => {
                const v = Math.min(SCENE_COUNT_MAX, Math.max(SCENE_COUNT_MIN, parseInt(e.target.value, 10) || 1));
                onConfigChange({ aiSceneCount: v, sceneCount: v });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Scene 1: 8 sec (~20 words). Scenes 2+: 7 sec (~17 words each). AI will generate and split the script across scenes.
            </p>
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
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <Label>Check sample script</Label>
            <p className="text-xs text-muted-foreground">
              Paste your full script to see how many scenes it requires. Scene 1: 8 sec (~20 words). Scenes 2+: 7 sec (~17 words each).
            </p>
            <Textarea
              placeholder="Paste your entire script..."
              value={sampleScript}
              onChange={(e) => { setSampleScript(e.target.value); setSampleCheck(null); setSceneEstimate(null); }}
              className="min-h-[100px] text-sm"
              rows={4}
            />
            <div className="flex gap-2 flex-wrap items-center">
              <Button type="button" onClick={handleEstimateScenes} disabled={!sampleScript.trim()}>
                Estimate scenes
              </Button>
              <span className="text-xs text-muted-foreground">or validate a segment:</span>
              <Select value={sampleSegmentType} onValueChange={(v: "0" | "1") => { setSampleSegmentType(v); setSampleCheck(null); setSceneEstimate(null); }}>
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
                Check segment
              </Button>
            </div>
            {sceneEstimate && (
              <div className="rounded-md bg-primary/10 text-primary px-3 py-2 text-sm font-medium flex items-center justify-between gap-2 flex-wrap">
                <span>
                  This script requires {sceneEstimate.sceneCount} scene{sceneEstimate.sceneCount !== 1 ? "s" : ""} ({sceneEstimate.wordCount} words total)
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => onConfigChange({ spinnerSceneCount: sceneEstimate.sceneCount, sceneCount: sceneEstimate.sceneCount })}>
                  Use {sceneEstimate.sceneCount} scenes
                </Button>
              </div>
            )}
            {sampleCheck && (
              <p className={cn("text-sm flex items-center gap-1.5", sampleCheck.result.fitsLimit ? "text-emerald-600" : "text-amber-600")}>
                {sampleCheck.result.fitsLimit ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                Segment: {sampleCheck.result.wordCount} words, ~{sampleCheck.result.estimatedSeconds}s
                {sampleCheck.result.fitsLimit ? " ✓" : ` (max ${sampleCheck.result.limitSeconds}s)`}
              </p>
            )}
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Number of scenes (1–{SCENE_COUNT_MAX.toLocaleString()})</Label>
            <Input
              type="number"
              min={SCENE_COUNT_MIN}
              max={SCENE_COUNT_MAX}
              value={config.spinnerSceneCount ?? config.sceneCount ?? 3}
              onChange={(e) => {
                const v = Math.min(SCENE_COUNT_MAX, Math.max(SCENE_COUNT_MIN, parseInt(e.target.value, 10) || 1));
                onConfigChange({ spinnerSceneCount: v, sceneCount: v });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Scene 1: 8 sec (~20 words). Scenes 2+: 7 sec (~17 words each).
            </p>
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
          <p className="text-xs text-muted-foreground">
            Paste your script in the box above first, then click Generate Rows—the script will be parsed into segments automatically.
          </p>
          <Button type="button" onClick={handleSpinnerGenerate} className="gap-2">
            <Upload className="h-4 w-4" />
            Generate Rows
          </Button>
        </div>
      )}
    </motion.div>
  );
}
