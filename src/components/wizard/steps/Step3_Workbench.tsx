import * as React from "react";
import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import { AvatarSelector, type AvatarOption } from "../AvatarSelector";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript, getSegments, setSegments, getVisualSegments, setVisualSegments, createEmptyRow } from "@/types/bulk";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 100;
const ROW_HEIGHT_WITH_VISUAL = 220;
const HEADER_HEIGHT = 44;

interface Step3_WorkbenchProps {
  rows: BatchRow[];
  onChange: (rows: BatchRow[]) => void;
  avatars: AvatarOption[];
  sceneCount?: number;
  showVisualContext?: boolean;
}

import { SCENE_COUNT_MAX } from "@/types/bulk";

const SEGMENT_KEYS = ["segment1", "segment2", "segment3", "segment4", "segment5"] as const;
const DISPLAY_SEGMENT_CAP = 50; // Show max 50 columns; rest accessible via data

export function Step3_Workbench({ rows, onChange, avatars, sceneCount = 3, showVisualContext = false }: Step3_WorkbenchProps) {
  const n = Math.min(SCENE_COUNT_MAX, Math.max(1, sceneCount));
  const displayN = Math.min(n, DISPLAY_SEGMENT_CAP);
  const parentRef = useRef<HTMLDivElement>(null);
  const rowH = showVisualContext ? ROW_HEIGHT_WITH_VISUAL : ROW_HEIGHT;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowH,
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
    const script = batchRowToScript(row, n);
    const hasScript = !!script.trim();
    const scriptOk = script.length <= 500;
    return !hasAvatar || !hasScript || !scriptOk;
  };

  const getSegmentValue = (row: BatchRow, i: number): string => {
    const segs = getSegments(row, n);
    return segs[i] ?? "";
  };

  const setSegmentValue = (row: BatchRow, i: number, val: string): Partial<BatchRow> => {
    const segs = getSegments(row, n);
    segs[i] = val;
    return setSegments(row, segs);
  };

  const getVisualValue = (row: BatchRow, i: number): string => {
    const segs = getVisualSegments(row, n);
    return segs[i] ?? "";
  };

  const setVisualValue = (row: BatchRow, i: number, val: string): Partial<BatchRow> => {
    const segs = getVisualSegments(row, n);
    segs[i] = val;
    return setVisualSegments(row, segs);
  };

  const addRow = useCallback(() => {
    const empty = createEmptyRow();
    const segs = Array(n).fill("");
    const withSegments = { ...empty, ...setSegments(empty, segs) } as BatchRow;
    const withVisual = showVisualContext
      ? { ...withSegments, ...setVisualSegments(withSegments, segs) }
      : withSegments;
    onChange([...rows, withVisual]);
  }, [rows, onChange, n, showVisualContext]);

  const copySegmentToAll = (index: number, segmentIndex: number) => {
    const row = rows[index];
    if (!row) return;
    const val = getSegmentValue(row, segmentIndex);
    const segs = getSegments(row, n);
    const filled = segs.map((_, i) => (i < n ? val : segs[i]));
    const next = [...rows];
    next[index] = { ...row, ...setSegments(row, filled) };
    onChange(next);
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
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold mb-2">Review your production queue</h2>
          <p className="text-muted-foreground">
            Edit any cell. Rows with missing data will be highlighted.
            Scene 1: 8 sec (~20 words). Scenes 2+: 7 sec (~17 words each).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add video
        </Button>
      </div>
      {n > DISPLAY_SEGMENT_CAP && (
        <p className="text-sm text-amber-600 mb-2">
          Showing first {DISPLAY_SEGMENT_CAP} of {n} segments. Use CSV for full edit.
        </p>
      )}

      <div ref={parentRef} className="flex-1 overflow-auto border rounded-lg overflow-x-auto">
        <div
          style={{ height: `${rowVirtualizer.getTotalSize() + HEADER_HEIGHT}px`, minWidth: `${displayN * (showVisualContext ? 220 : 140) + 200}px` }}
          className="relative w-full"
        >
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 flex items-center border-b bg-muted/80 font-medium text-sm min-w-max"
            style={{ height: HEADER_HEIGHT }}
          >
            <div className="w-12 px-2 shrink-0">#</div>
            <div className="w-36 px-2 shrink-0">Avatar</div>
            {Array.from({ length: displayN }, (_, i) => (
              <div key={i} className={cn("flex-1 px-2", showVisualContext ? "min-w-[220px]" : "min-w-[140px]")}>
                Seg {i + 1}{i === 0 ? " (8s)" : " (7s)"}
                {showVisualContext && (
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">Script + Visual</div>
                )}
              </div>
            ))}
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
                  "absolute left-0 flex items-stretch border-b min-w-max",
                  invalid && "bg-red-50/50 dark:bg-red-950/20"
                )}
                style={{
                  height: rowH,
                  top: virtualRow.start + HEADER_HEIGHT,
                  width: "100%",
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
                {Array.from({ length: displayN }, (_, i) => {
                  const val = getSegmentValue(row, i);
                  const visualVal = showVisualContext ? getVisualValue(row, i) : "";
                  return (
                    <div key={i} className={cn("flex-1 px-2 py-1 flex flex-col gap-0.5", showVisualContext ? "min-w-[220px]" : "min-w-[140px]")}>
                      <div className="flex flex-col gap-1.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Script (dialogue)</label>
                          <Textarea
                            value={val}
                            onChange={(e) => updateRow(virtualRow.index, setSegmentValue(row, i, e.target.value))}
                            placeholder={showVisualContext ? "Spoken words..." : "..."}
                            className={cn(
                              "min-h-[70px] text-sm resize-y mt-0.5",
                              batchRowToScript(row, n).length > 500 && "border-red-500"
                            )}
                            rows={3}
                          />
                        </div>
                        {showVisualContext && (
                          <div>
                            <label className="text-[10px] text-muted-foreground">Visual (context)</label>
                            <Textarea
                              value={visualVal}
                              onChange={(e) => updateRow(virtualRow.index, setVisualValue(row, i, e.target.value))}
                              placeholder="Scene description..."
                              className="min-h-[70px] text-sm resize-y mt-0.5"
                              rows={3}
                            />
                          </div>
                        )}
                      </div>
                      {n > 1 && !showVisualContext && (
                        <button
                          type="button"
                          onClick={() => copySegmentToAll(virtualRow.index, i)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Copy to all
                        </button>
                      )}
                      {n > 1 && showVisualContext && (
                        <button
                          type="button"
                          onClick={() => copySegmentToAll(virtualRow.index, i)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Copy script to all
                        </button>
                      )}
                    </div>
                  );
                })}
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
