import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Beaker, Rocket } from "lucide-react";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript } from "@/types/bulk";
import { cn } from "@/lib/utils";

const COST_PER_VIDEO = 10;

function getValidRows(rows: BatchRow[]): BatchRow[] {
  return rows.filter((r) => {
    const hasAvatar = !!(r.avatar_id || r.avatar_name);
    const script = batchRowToScript(r);
    const hasScript = !!script.trim();
    const scriptOk = script.length <= 500;
    return hasAvatar && hasScript && scriptOk;
  });
}

function getInvalidCount(rows: BatchRow[]): number {
  return rows.filter((r) => {
    const hasAvatar = !!(r.avatar_id || r.avatar_name);
    const script = batchRowToScript(r);
    const hasScript = !!script.trim();
    const scriptOk = script.length <= 500;
    return !hasAvatar || !hasScript || !scriptOk;
  }).length;
}

interface SafetyLaunchBarProps {
  rows: BatchRow[];
  onLaunch: (isTestRun: boolean) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function SafetyLaunchBar({
  rows,
  onLaunch,
  isSubmitting = false,
  className,
}: SafetyLaunchBarProps) {
  const validRows = getValidRows(rows);
  const invalidCount = getInvalidCount(rows);
  const count = validRows.length;
  const cost = count * COST_PER_VIDEO;
  const disabled = count === 0 || invalidCount > 0 || isSubmitting;

  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t bg-slate-900 text-slate-100",
        className
      )}
    >
      <TooltipProvider>
        <div className="max-w-full mx-auto px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="font-medium text-white">{count}</span> valid rows
            </span>
            {invalidCount > 0 && (
              <span className="text-amber-400">{invalidCount} invalid</span>
            )}
            <span className="text-slate-400">
              Est. <span className="font-mono font-medium text-white">${cost}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onLaunch(true)}
                    disabled={disabled}
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900"
                  >
                    <Beaker className="h-4 w-4" />
                    Test First 3
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Generates 3 samples ($0.10) to verify quality.
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              onClick={() => onLaunch(false)}
              disabled={disabled}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Rocket className="h-4 w-4" />
              Launch {count} Videos (${cost})
            </Button>
          </div>
        </div>
      </TooltipProvider>
    </footer>
  );
}
