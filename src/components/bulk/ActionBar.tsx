import * as React from "react";
import { Button } from "@/components/ui/button";
import { Beaker, Rocket } from "lucide-react";
import type { BatchRow } from "./SmartTable";
import { cn } from "@/lib/utils";

const COST_PER_VIDEO = 10;

function hasRowErrors(rows: BatchRow[]): boolean {
  return rows.some((r) => {
    const missingAvatar = !r.avatar_id && !r.avatar_name;
    const scriptTooLong = r.script.length > 500;
    const emptyScript = !r.script.trim();
    return missingAvatar || scriptTooLong || emptyScript;
  });
}

function getValidRowCount(rows: BatchRow[]): number {
  return rows.filter(
    (r) => (r.avatar_id || r.avatar_name) && r.script.trim() && r.script.length <= 500
  ).length;
}

interface ActionBarProps {
  rows: BatchRow[];
  onLaunch: (isTestRun: boolean) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function ActionBar({
  rows,
  onLaunch,
  isSubmitting = false,
  className,
}: ActionBarProps) {
  const validCount = getValidRowCount(rows);
  const hasErrors = hasRowErrors(rows);
  const costEstimate = validCount * COST_PER_VIDEO;
  const disabled = hasErrors || validCount === 0 || isSubmitting;

  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{validCount}</span> valid rows
          </span>
          <span className="text-sm text-muted-foreground">
            Est. cost: <span className="font-mono font-medium">${costEstimate}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onLaunch(true)}
            disabled={disabled}
            className="gap-2"
          >
            <Beaker className="h-4 w-4" />
            Test First 3
          </Button>
          <Button
            type="button"
            onClick={() => onLaunch(false)}
            disabled={disabled}
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            Launch Full Batch
          </Button>
        </div>
      </div>
    </footer>
  );
}
