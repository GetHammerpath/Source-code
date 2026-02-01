import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownToLine, Sparkles } from "lucide-react";
import { HybridAvatarSelector, type AvatarOption } from "./HybridAvatarSelector";
import { cn } from "@/lib/utils";

const SCRIPT_MAX = 500;
const ASPECT_OPTIONS = ["16:9", "9:16", "1:1"];

export interface BatchRow {
  id: string;
  avatar_id: string;
  avatar_name: string;
  script: string;
  background: string;
  aspect_ratio: string;
  is_new_generation?: boolean;
}

interface SmartTableProps {
  rows: BatchRow[];
  onChange: (rows: BatchRow[]) => void;
  avatars: AvatarOption[];
  selectedRowIndices: Set<number>;
  onSelectionChange: (indices: Set<number>) => void;
  onFillDown: () => void;
  onAutoCastEmpty: () => void;
}

export function SmartTable({
  rows,
  onChange,
  avatars,
  selectedRowIndices,
  onSelectionChange,
  onFillDown,
  onAutoCastEmpty,
}: SmartTableProps) {
  const updateRow = (index: number, updates: Partial<BatchRow>) => {
    const next = [...rows];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const toggleRowSelection = (index: number) => {
    const next = new Set(selectedRowIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onSelectionChange(next);
  };

  const selectAll = () => {
    if (selectedRowIndices.size === rows.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((_, i) => i)));
    }
  };

  const invalidAvatar = (row: BatchRow) => !row.avatar_id && !row.avatar_name;
  const invalidScript = (row: BatchRow) => row.script.length > SCRIPT_MAX;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        Add rows using Upload CSV, AI Campaign, or Spinner above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFillDown}
          className="gap-2"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Fill Down
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAutoCastEmpty}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Auto-Cast Empty
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={selectAll}
        >
          {selectedRowIndices.size === rows.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedRowIndices.size === rows.length}
                  onChange={selectAll}
                  className="rounded"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium">Avatar</th>
              <th className="text-left px-3 py-2 font-medium">Script</th>
              <th className="text-left px-3 py-2 font-medium">Background</th>
              <th className="text-left px-3 py-2 font-medium w-28">Aspect Ratio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b last:border-b-0",
                  selectedRowIndices.has(i) && "bg-primary/5"
                )}
              >
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectedRowIndices.has(i)}
                    onChange={() => toggleRowSelection(i)}
                    className="rounded"
                  />
                </td>
                <td className="px-3 py-2">
                  <HybridAvatarSelector
                    value={row.avatar_id || row.avatar_name || ""}
                    onChange={(id, name, isNew) => {
                      updateRow(i, {
                        avatar_id: id.startsWith("__") ? "" : id,
                        avatar_name: name,
                        is_new_generation: isNew,
                      });
                    }}
                    avatars={avatars}
                    invalid={invalidAvatar(row)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.script}
                    onChange={(e) => updateRow(i, { script: e.target.value })}
                    placeholder="Enter script..."
                    className={cn(
                      "min-w-[200px]",
                      invalidScript(row) && "border-red-500 bg-red-50 dark:bg-red-950/20"
                    )}
                  />
                  {invalidScript(row) && (
                    <span className="text-xs text-red-600">
                      Max {SCRIPT_MAX} chars ({row.script.length})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.background}
                    onChange={(e) => updateRow(i, { background: e.target.value })}
                    placeholder="Background..."
                    className="min-w-[120px]"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={row.aspect_ratio || "16:9"}
                    onValueChange={(v) => updateRow(i, { aspect_ratio: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_OPTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
