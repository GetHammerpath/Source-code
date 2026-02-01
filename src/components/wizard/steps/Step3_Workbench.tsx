import * as React from "react";
import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { AvatarSelector, type AvatarOption } from "../AvatarSelector";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript } from "@/types/bulk";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 72;
const HEADER_HEIGHT = 44;

interface Step3_WorkbenchProps {
  rows: BatchRow[];
  onChange: (rows: BatchRow[]) => void;
  avatars: AvatarOption[];
}

export function Step3_Workbench({ rows, onChange, avatars }: Step3_WorkbenchProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const updateRow = useCallback(
    (index: number, updates: Partial<BatchRow>) => {
      const next = [...rows];
      next[index] = { ...next[index], ...updates };
      onChange(next);
    },
    [rows, onChange]
  );

  const deleteRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, i) => i !== index));
    },
    [rows, onChange]
  );

  const invalidRow = (row: BatchRow) => {
    const hasAvatar = !!(row.avatar_id || row.avatar_name);
    const script = batchRowToScript(row);
    const hasScript = !!script.trim();
    const scriptOk = script.length <= 500;
    return !hasAvatar || !hasScript || !scriptOk;
  };

  if (rows.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24 text-muted-foreground"
      >
        <p className="text-lg mb-2">No rows yet</p>
        <p className="text-sm">Go back to Step 2 and configure your campaign.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-[60vh] min-h-[400px]"
    >
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">Review your production queue</h2>
        <p className="text-muted-foreground">
          Edit any cell. Rows with missing data will be highlighted.
        </p>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto border rounded-lg">
        <div
          style={{ height: `${rowVirtualizer.getTotalSize() + HEADER_HEIGHT}px` }}
          className="relative w-full"
        >
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 flex items-center border-b bg-muted/80 font-medium text-sm"
            style={{ height: HEADER_HEIGHT }}
          >
            <div className="w-12 px-2 shrink-0">#</div>
            <div className="w-36 px-2 shrink-0">Avatar</div>
            <div className="flex-1 min-w-[100px] px-2">Segment 1</div>
            <div className="flex-1 min-w-[100px] px-2">Segment 2</div>
            <div className="flex-1 min-w-[100px] px-2">Segment 3</div>
            <div className="w-12 px-2 shrink-0" />
          </div>

          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            const invalid = invalidRow(row);
            return (
              <div
                key={row.id}
                className={cn(
                  "absolute left-0 w-full flex items-stretch border-b",
                  invalid && "bg-red-50/50 dark:bg-red-950/20"
                )}
                style={{
                  height: ROW_HEIGHT,
                  top: virtualRow.start + HEADER_HEIGHT,
                }}
              >
                <div className="w-12 px-2 flex items-center text-muted-foreground text-sm shrink-0">
                  {virtualRow.index + 1}
                </div>
                <div className="w-36 px-2 py-1 flex items-center shrink-0">
                  <AvatarSelector
                    value={row.avatar_id || row.avatar_name || ""}
                    onChange={(id, name) => updateRow(virtualRow.index, { avatar_id: id, avatar_name: name })}
                    avatars={avatars}
                    invalid={!row.avatar_id && !row.avatar_name}
                  />
                </div>
                <div className="flex-1 min-w-[100px] px-2 py-1">
                  <Textarea
                    value={row.segment1}
                    onChange={(e) => updateRow(virtualRow.index, { segment1: e.target.value })}
                    placeholder="..."
                    className={cn(
                      "min-h-[56px] text-sm resize-none",
                      batchRowToScript(row).length > 500 && "border-red-500"
                    )}
                    rows={2}
                  />
                </div>
                <div className="flex-1 min-w-[100px] px-2 py-1">
                  <Textarea
                    value={row.segment2}
                    onChange={(e) => updateRow(virtualRow.index, { segment2: e.target.value })}
                    placeholder="..."
                    className="min-h-[56px] text-sm resize-none"
                    rows={2}
                  />
                </div>
                <div className="flex-1 min-w-[100px] px-2 py-1">
                  <Textarea
                    value={row.segment3}
                    onChange={(e) => updateRow(virtualRow.index, { segment3: e.target.value })}
                    placeholder="..."
                    className="min-h-[56px] text-sm resize-none"
                    rows={2}
                  />
                </div>
                <div className="w-12 px-2 flex items-center shrink-0">
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
    </motion.div>
  );
}
