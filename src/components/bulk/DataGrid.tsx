import * as React from "react";
import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, FileUp, Sparkles } from "lucide-react";
import { HybridAvatarSelector, type AvatarOption } from "./HybridAvatarSelector";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript } from "@/types/bulk";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 44;

interface DataGridProps {
  rows: BatchRow[];
  onChange: (rows: BatchRow[]) => void;
  avatars: AvatarOption[];
  searchFilter: string;
  onImportClick?: () => void;
  onAiClick?: () => void;
}

export function DataGrid({
  rows,
  onChange,
  avatars,
  searchFilter,
  onImportClick,
  onAiClick,
}: DataGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredRows = React.useMemo(() => {
    if (!searchFilter.trim()) return rows;
    const q = searchFilter.toLowerCase();
    return rows.filter(
      (r) =>
        r.avatar_name?.toLowerCase().includes(q) ||
        r.segment1?.toLowerCase().includes(q) ||
        r.segment2?.toLowerCase().includes(q) ||
        r.segment3?.toLowerCase().includes(q)
    );
  }, [rows, searchFilter]);

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const updateRow = useCallback(
    (index: number, updates: Partial<BatchRow>) => {
      const realIndex = filteredRows[index];
      if (!realIndex) return;
      const globalIndex = rows.findIndex((r) => r.id === realIndex.id);
      if (globalIndex < 0) return;
      const next = [...rows];
      next[globalIndex] = { ...next[globalIndex], ...updates };
      onChange(next);
    },
    [rows, filteredRows, onChange]
  );

  const deleteRow = useCallback(
    (index: number) => {
      const r = filteredRows[index];
      if (!r) return;
      onChange(rows.filter((row) => row.id !== r.id));
    },
    [rows, filteredRows, onChange]
  );

  const invalidAvatar = (row: BatchRow) => !row.avatar_id && !row.avatar_name;
  const invalidScript = (row: BatchRow) => batchRowToScript(row).length > 500;

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg m-4 bg-muted/20">
        <div className="text-center space-y-4 p-8">
          <p className="text-muted-foreground text-lg">No rows yet</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={onImportClick} className="gap-2">
              <FileUp className="h-4 w-4" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={onAiClick} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Start with AI
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        style={{ height: `${rowVirtualizer.getTotalSize() + HEADER_HEIGHT}px` }}
        className="relative w-full"
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 flex items-center border-b bg-background font-medium text-sm"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="w-12 px-2 shrink-0">#</div>
          <div className="w-40 px-2 shrink-0">Avatar ID</div>
          <div className="flex-1 min-w-[120px] px-2">Segment 1</div>
          <div className="flex-1 min-w-[120px] px-2">Segment 2</div>
          <div className="flex-1 min-w-[120px] px-2">Segment 3</div>
          <div className="w-14 px-2 shrink-0">Actions</div>
        </div>

        {virtualRows.map((virtualRow) => {
          const row = filteredRows[virtualRow.index];
          if (!row) return null;
          return (
            <div
              key={row.id}
              className="absolute left-0 w-full flex items-stretch border-b"
              style={{
                height: ROW_HEIGHT,
                top: virtualRow.start + HEADER_HEIGHT,
              }}
            >
              <div className="w-12 px-2 flex items-center text-muted-foreground text-sm shrink-0">
                {virtualRow.index + 1}
              </div>
              <div className="w-40 px-2 py-1 flex items-center shrink-0">
                <HybridAvatarSelector
                  value={row.avatar_id || row.avatar_name || ""}
                  onChange={(id, name) => updateRow(virtualRow.index, { avatar_id: id, avatar_name: name })}
                  avatars={avatars}
                  invalid={invalidAvatar(row)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex-1 min-w-[120px] px-2 py-1">
                <Textarea
                  value={row.segment1}
                  onChange={(e) => updateRow(virtualRow.index, { segment1: e.target.value })}
                  placeholder="..."
                  className={cn(
                    "min-h-[60px] text-sm resize-none",
                    invalidScript(row) && "border-red-500"
                  )}
                  rows={2}
                />
              </div>
              <div className="flex-1 min-w-[120px] px-2 py-1">
                <Textarea
                  value={row.segment2}
                  onChange={(e) => updateRow(virtualRow.index, { segment2: e.target.value })}
                  placeholder="..."
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="flex-1 min-w-[120px] px-2 py-1">
                <Textarea
                  value={row.segment3}
                  onChange={(e) => updateRow(virtualRow.index, { segment3: e.target.value })}
                  placeholder="..."
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="w-14 px-2 flex items-center shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteRow(virtualRow.index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
