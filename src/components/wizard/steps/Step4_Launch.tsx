import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Beaker, Rocket, AlertTriangle } from "lucide-react";
import type { BatchRow } from "@/types/bulk";
import { getRowScriptStatus } from "@/types/bulk";
import { cn } from "@/lib/utils";
import { estimateCreditsForModel, calculateCreditPrice } from "@/lib/billing/pricing";
import { getVideoModel, getFallbackModel } from "@/lib/video-models";

interface Step4_LaunchProps {
  rows: BatchRow[];
  onLaunch: (isTestRun: boolean) => void;
  isSubmitting?: boolean;
  sceneCount?: number;
  model?: string;
}

function getValidRows(rows: BatchRow[], sceneCount: number): BatchRow[] {
  return rows.filter((r) => {
    const hasAvatar = !!(r.avatar_id || r.avatar_name);
    const { hasScript, fitsLimits } = getRowScriptStatus(r, sceneCount);
    return hasAvatar && hasScript && fitsLimits;
  });
}

export function Step4_Launch({ rows, onLaunch, isSubmitting, sceneCount = 3, model = "veo3_fast" }: Step4_LaunchProps) {
  const validRows = getValidRows(rows, sceneCount);
  const count = validRows.length;
  const creditsPerVideo = estimateCreditsForModel(sceneCount, model);
  const totalCredits = count * creditsPerVideo;
  const cost = calculateCreditPrice(totalCredits);
  const testCredits = Math.min(3, count) * creditsPerVideo;
  const testCost = calculateCreditPrice(testCredits);
  const invalidCount = rows.length - count;
  const disabled = count === 0 || isSubmitting;
  
  // Phase 4: Check if model requires images and count rows without images
  const selectedModel = getVideoModel(model);
  const fallbackModel = getFallbackModel(model);
  const isImageOnlyModel = selectedModel && !selectedModel.supportsText2Video;
  const rowsWithoutImage = isImageOnlyModel
    ? validRows.filter((r) => !r.avatar_id || r.avatar_id.startsWith("__"))
    : [];
  const rowsWithImage = count - rowsWithoutImage.length;

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
        <p className="text-xs text-muted-foreground mt-1">
          Scene 1: 8 sec. Scenes 2+: 7 sec each.
        </p>
      </div>

      {invalidCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {invalidCount} row(s) have missing data and will be skipped. Fix them in Step 3 if needed.
          </p>
        </div>
      )}

      {/* Phase 4: Fallback model warning for image-only models */}
      {isImageOnlyModel && rowsWithoutImage.length > 0 && fallbackModel && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Automatic fallback enabled
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {selectedModel?.label} requires avatar images. {rowsWithoutImage.length} row(s) without images will automatically use {fallbackModel.label} instead.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                {rowsWithImage} rows with {selectedModel?.label} • {rowsWithoutImage.length} rows with {fallbackModel.label}
              </p>
            </div>
          </div>
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
