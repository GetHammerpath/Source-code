import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Beaker, Rocket } from "lucide-react";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript } from "@/types/bulk";
import { cn } from "@/lib/utils";

const COST_PER_VIDEO = 10;

function getValidRows(rows: BatchRow[]): BatchRow[] {
  return rows.filter((r) => {
    const hasAvatar = !!(r.avatar_id || r.avatar_name);
    const script = batchRowToScript(r);
    return hasAvatar && script.trim() && script.length <= 500;
  });
}

interface Step4_LaunchProps {
  rows: BatchRow[];
  onLaunch: (isTestRun: boolean) => void;
  isSubmitting?: boolean;
}

export function Step4_Launch({ rows, onLaunch, isSubmitting }: Step4_LaunchProps) {
  const validRows = getValidRows(rows);
  const count = validRows.length;
  const cost = count * COST_PER_VIDEO;
  const testCost = Math.min(3, count) * COST_PER_VIDEO;
  const invalidCount = rows.length - count;
  const disabled = count === 0 || isSubmitting;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold mb-2">Ready to go live?</h2>
        <p className="text-muted-foreground">
          You are about to generate {count} videos. Est. Cost: ${cost.toLocaleString()}.
        </p>
      </div>

      {invalidCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {invalidCount} row(s) have missing data and will be skipped. Fix them in Step 3 if needed.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border-2 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Test First 3 (Recommended)</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Run a small test (${testCost.toFixed(2)}) to check quality before committing to the full run.
          </p>
          <Button
            onClick={() => onLaunch(true)}
            disabled={disabled}
            className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            <Beaker className="h-4 w-4" />
            Test First 3
          </Button>
        </div>

        <div className="rounded-xl border-2 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold">Launch Full Batch (Advanced)</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Commit to the full run. ${cost.toLocaleString()} for {count} videos.
          </p>
          <Button
            onClick={() => onLaunch(false)}
            disabled={disabled}
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Rocket className="h-4 w-4" />
            Launch {count} Videos (${cost.toLocaleString()})
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
