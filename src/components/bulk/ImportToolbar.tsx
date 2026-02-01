import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Sparkles, RotateCw, Search, Loader2 } from "lucide-react";
import type { BatchRow } from "@/types/bulk";
import { createEmptyRow } from "@/types/bulk";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface ImportToolbarProps {
  onImport: (rows: BatchRow[]) => void;
  onImportCsvClick?: () => void;
  aiSheetOpen?: boolean;
  onAiSheetOpenChange?: (open: boolean) => void;
  searchFilter: string;
  onSearchChange: (value: string) => void;
  avatars: { id: string; name: string }[];
  onAiGenerate?: (prompt: string) => Promise<BatchRow[]>;
  disabled?: boolean;
}

export function ImportToolbar({
  onImport,
  onImportCsvClick,
  aiSheetOpen,
  onAiSheetOpenChange,
  searchFilter,
  onSearchChange,
  avatars,
  onAiGenerate,
  disabled,
}: ImportToolbarProps) {

  const handleSpinAvatars = () => {
    if (avatars.length === 0) return;
    const rows: BatchRow[] = Array.from({ length: 10 }, () => {
      const r = createEmptyRow();
      r.id = uuid();
      const a = avatars[Math.floor(Math.random() * avatars.length)];
      r.avatar_id = a.id;
      r.avatar_name = a.name;
      r.segment1 = "Enter script...";
      return r;
    });
    onImport(rows);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onImportCsvClick}
          disabled={disabled}
          className="gap-2"
        >
          <FileUp className="h-4 w-4" />
          Import CSV
        </Button>
        <Sheet open={aiSheetOpen} onOpenChange={onAiSheetOpenChange}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Campaign
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>AI Campaign</SheetTitle>
            </SheetHeader>
            <AICampaignSheetContent onAiGenerate={onAiGenerate} onImport={onImport} />
          </SheetContent>
        </Sheet>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSpinAvatars}
          disabled={disabled || avatars.length === 0}
          className="gap-2"
        >
          <RotateCw className="h-4 w-4" />
          Spin Avatars
        </Button>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rows..."
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>
    </div>
  );
}

function AICampaignSheetContent({
  onAiGenerate,
  onImport,
}: {
  onAiGenerate?: (prompt: string) => Promise<BatchRow[]>;
  onImport: (rows: BatchRow[]) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      if (onAiGenerate) {
        const rows = await onAiGenerate(prompt.trim());
        onImport(rows);
      } else {
        const r = createEmptyRow();
        r.id = uuid();
        r.segment1 = prompt.trim();
        r.avatar_id = "__auto_professional__";
        r.avatar_name = "Auto-Cast: Professional";
        onImport([r]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <Textarea
        placeholder="e.g. Sell coffee to millennials"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[100px]"
      />
      <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate
      </Button>
    </div>
  );
}
