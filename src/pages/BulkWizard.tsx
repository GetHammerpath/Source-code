import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { launchBatch } from "@/lib/api/bulk";
import type { LaunchRow } from "@/lib/api/bulk";
import { Button } from "@/components/ui/button";
import { Step1_Strategy, type StrategyChoice } from "@/components/wizard/steps/Step1_Strategy";
import { Step2_Config, type Step2Config } from "@/components/wizard/steps/Step2_Config";
import { Step3_Workbench } from "@/components/wizard/steps/Step3_Workbench";
import { Step4_Launch } from "@/components/wizard/steps/Step4_Launch";
import type { BatchRow } from "@/types/bulk";
import { batchRowToScript, batchRowToScenePrompts } from "@/types/bulk";
import type { AvatarOption } from "@/components/wizard/AvatarSelector";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Strategy", "Setup", "Workbench", "Launch"];

export default function BulkWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [strategy, setStrategy] = useState<StrategyChoice>(null);
  const [step2Config, setStep2Config] = useState<Step2Config>({ sceneCount: 3 });
  const [campaignData, setCampaignData] = useState<BatchRow[]>([]);
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        .select("id, name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setAvatars(data || []);
    };
    fetchAvatars();
  }, [userId]);

  const canProceed = () => {
    if (currentStep === 0) return !!strategy;
    if (currentStep === 1) return campaignData.length > 0;
    if (currentStep === 2) return campaignData.length > 0;
    return true;
  };

  const handleNext = () => {
    if (currentStep < 3 && canProceed()) setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const sceneCount = Math.min(1000, Math.max(1, step2Config.sceneCount ?? 3));

  const rowsToLaunchRows = (rows: BatchRow[]): LaunchRow[] =>
    rows
      .filter((r) => (r.avatar_id || r.avatar_name) && batchRowToScript(r, sceneCount).trim())
      .map((r) => {
        const scenePrompts = batchRowToScenePrompts(r, sceneCount);
        return {
          avatar_id: r.avatar_id?.startsWith("__") ? undefined : (r.avatar_id || undefined),
          avatar_name: r.avatar_name || undefined,
          script: batchRowToScript(r, sceneCount),
          scene_prompts: scenePrompts ?? undefined,
          aspect_ratio: "16:9",
        };
      });

  const handleLaunch = async (isTestRun: boolean) => {
    if (!userId) return;
    const valid = rowsToLaunchRows(campaignData);
    if (valid.length === 0) {
      toast({ title: "No valid rows", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await launchBatch(
        userId,
        valid,
        {
          name: `Batch ${new Date().toISOString().slice(0, 10)}`,
          imageUrl: null,
          industry: "General",
          city: "N/A",
          model: "veo3_fast",
          aspectRatio: "16:9",
          numberOfScenes: sceneCount,
          generationType: "TEXT_2_VIDEO",
        },
        isTestRun,
        strategy ?? "csv"
      );

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
  };

  if (!userId) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b px-6 py-4">
        <p className="text-sm text-muted-foreground mb-2">
          Bulk Studio &gt; {strategy === "csv" ? "CSV Upload" : strategy === "ai" ? "AI Generator" : strategy === "spinner" ? "Avatar Spinner" : "New Batch"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => i < currentStep && setCurrentStep(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors",
                  i === currentStep && "font-medium text-primary",
                  i < currentStep && "cursor-pointer hover:bg-muted",
                  i > currentStep && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0",
                    i === currentStep
                      ? "bg-primary text-primary-foreground"
                      : i < currentStep
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto px-6 py-8 pb-24">
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <Step1_Strategy key="step1" selected={strategy} onSelect={setStrategy} />
          )}
          {currentStep === 1 && (
            <Step2_Config
              key="step2"
              strategy={strategy}
              config={step2Config}
              existingRows={campaignData}
              onConfigChange={(updates) => setStep2Config((prev) => ({ ...prev, ...updates }))}
              onRowsReady={(rows, opts) => {
                setCampaignData(rows);
                if (opts?.fromEstimateScenes) {
                  toast({ title: "Scenes estimated", description: `${rows.length} row(s) ready. Click Next to review in Workbench.` });
                } else if (strategy && strategy !== "csv") {
                  toast({ title: "Template ready", description: `${rows.length} row(s) created. Review in Workbench.` });
                  setCurrentStep(2);
                }
              }}
            />
          )}
          {currentStep === 2 && (
            <Step3_Workbench
              key="step3"
              rows={campaignData}
              onChange={setCampaignData}
              avatars={avatars}
              sceneCount={sceneCount}
              showVisualContext={strategy === "ai" || strategy === "csv"}
            />
          )}
          {currentStep === 3 && (
            <Step4_Launch
              key="step4"
              rows={campaignData}
              onLaunch={handleLaunch}
              isSubmitting={isSubmitting}
              sceneCount={sceneCount}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="shrink-0 fixed bottom-0 left-0 right-0 border-t bg-background px-6 py-4 flex justify-between">
        <div>
          {currentStep > 0 && (
            <Button type="button" variant="outline" onClick={handleBack} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>
        <div>
          {currentStep < 3 && (
            <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>

      <div className="h-16" />
    </div>
  );
}
