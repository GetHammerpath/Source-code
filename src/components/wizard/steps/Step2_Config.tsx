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
import { createEmptyRow } from "@/types/bulk";
import { Upload, FileSpreadsheet } from "lucide-react";
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
  spinnerCount?: number;
  spinnerGender?: string;
  spinnerAge?: string;
}

export function Step2_Config({ strategy, config, onConfigChange, onRowsReady }: Step2_ConfigProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
          r.segment1 = p.script || p.prompt || p.segment1 || "";
          r.segment2 = p.segment2 || "";
          r.segment3 = p.segment3 || "";
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
          number_of_scenes: 1,
          generation_mode: "text",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "AI generation failed");
      const script = data.prompt ?? topic;
      const r = createEmptyRow();
      r.id = uuid();
      r.segment1 = script;
      r.avatar_id = tone === "casual" ? "__auto_casual__" : "__auto_professional__";
      r.avatar_name = tone === "casual" ? "Auto-Cast: Casual" : "Auto-Cast: Professional";
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
      r.segment1 = topic;
      r.avatar_id = "__auto_professional__";
      r.avatar_name = "Auto-Cast: Professional";
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
      r.segment1 = "Enter script...";
      return r;
    });
    onRowsReady(rows);
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
          <Button type="button" onClick={handleSpinnerGenerate} className="gap-2">
            <Upload className="h-4 w-4" />
            Generate Rows
          </Button>
        </div>
      )}
    </motion.div>
  );
}
