import { useState, useEffect, useRef, useCallback } from "react";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { launchBatch } from "@/lib/api/bulk";
import type { LaunchRow } from "@/lib/api/bulk";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImportToolbar } from "@/components/bulk/ImportToolbar";
import { DataGrid } from "@/components/bulk/DataGrid";
import { SafetyLaunchBar } from "@/components/bulk/SafetyLaunchBar";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript, createEmptyRow } from "@/types/bulk";
import type { AvatarOption } from "@/components/bulk/HybridAvatarSelector";
import { cn } from "@/lib/utils";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_BASE_CONFIG = {
  name: "",
  imageUrl: null as string | null,
  industry: "",
  city: "",
  storyIdea: "",
  model: "veo3_fast" as const,
  aspectRatio: "16:9" as const,
  numberOfScenes: 3 as number,
  generationType: "TEXT_2_VIDEO" as const,
};

export default function BulkWorkspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseConfig, setBaseConfig] = useState(DEFAULT_BASE_CONFIG);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
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

  const rowsToLaunchRows = useCallback((rows: BatchRow[]): LaunchRow[] => {
    return rows
      .filter((r) => (r.avatar_id || r.avatar_name) && batchRowToScript(r).trim())
      .map((r) => ({
        avatar_id: r.avatar_id?.startsWith("__") ? undefined : (r.avatar_id || undefined),
        avatar_name: r.avatar_name || undefined,
        script: batchRowToScript(r),
        aspect_ratio: "16:9",
      }));
  }, []);

  const handleLaunch = useCallback(
    async (isTestRun: boolean) => {
      if (!userId) return;
      const valid = rowsToLaunchRows(rows);
      if (valid.length === 0) {
        toast({ title: "No valid rows", variant: "destructive" });
        return;
      }
      const name = baseConfig.name.trim() || `Batch ${new Date().toISOString().slice(0, 10)}`;
      const industry = baseConfig.industry.trim() || "General";
      const city = baseConfig.city.trim() || "N/A";

      setIsSubmitting(true);
      try {
        const result = await launchBatch(userId, valid, {
          ...baseConfig,
          name,
          industry,
          city,
        }, isTestRun);

        toast({
          title: isTestRun ? "Test run started!" : "Bulk generation started!",
          description: isTestRun ? "Generating first 3 videos" : `Creating ${valid.length} videos`,
        });

        navigate(`/batch/${result.batch_id}`);
      } catch (err) {
        toast({
          title: "Launch failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, rows, baseConfig, rowsToLaunchRows, toast, navigate]
  );

  const triggerImport = () => fileInputRef.current?.click();

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: { data: Record<string, string>[] }) => {
        const parsed = results.data;
        const newRows: BatchRow[] = parsed.map((p) => {
          const r = createEmptyRow();
          r.id = uuid();
          r.avatar_id = p.avatar_id || p.avatar || "";
          r.avatar_name = p.avatar_name || p.avatar || p.name || "";
          r.segment1 = p.script || p.prompt || p.segment1 || "";
          r.segment2 = p.segment2 || "";
          r.segment3 = p.segment3 || "";
          return r;
        });
        setRows((prev) => [...prev, ...newRows]);
        toast({ title: "CSV imported", description: `${newRows.length} rows` });
      },
    });
    e.target.value = "";
  };

  const validCount = rows.filter((r) => {
    const hasAvatar = !!(r.avatar_id || r.avatar_name);
    const script = batchRowToScript(r);
    return hasAvatar && script.trim() && script.length <= 500;
  }).length;
  const cost = validCount * 10;

  if (!userId) return null;

  return (
    <div className="flex flex-col h-[100vh] bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-xl font-bold">Bulk Studio</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} rows · {validCount} valid · ${cost} est.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate("/bulk-video")}>
              Batch list
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/dashboard")}>
              Dashboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCsvImport}
        />

        <ImportToolbar
          onImport={(newRows) => setRows((prev) => [...prev, ...newRows])}
          onImportCsvClick={triggerImport}
          aiSheetOpen={aiSheetOpen}
          onAiSheetOpenChange={setAiSheetOpen}
          searchFilter={searchFilter}
          onSearchChange={setSearchFilter}
          avatars={avatars}
          disabled={isSubmitting}
        />

        <DataGrid
          rows={rows}
          onChange={setRows}
          avatars={avatars}
          searchFilter={searchFilter}
          onImportClick={triggerImport}
          onAiClick={() => setAiSheetOpen(true)}
        />
      </main>

      {/* Footer */}
      <SafetyLaunchBar
        rows={rows}
        onLaunch={handleLaunch}
        isSubmitting={isSubmitting}
      />

      {/* Spacer for fixed footer */}
      <div className="h-20 shrink-0" />
    </div>
  );
}
