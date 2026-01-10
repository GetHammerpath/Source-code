import { Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FormTipsProps {
  step: number;
}

const FormTips = ({ step }: FormTipsProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const tips: Record<number, { title: string; tips: string[] }> = {
    1: {
      title: "Image Tips",
      tips: [
        "Use high-resolution images (1080p or higher)",
        "Ensure good lighting and clear subjects",
        "Horizontal images work best for landscape videos",
        "Avoid blurry or heavily filtered images"
      ]
    },
    2: {
      title: "Details Tips",
      tips: [
        "Be specific about your industry for better prompts",
        "Use a professional name for the avatar",
        "Include your actual city for local relevance",
        "Describe a clear marketing story with problem → solution"
      ]
    },
    3: {
      title: "Prompt Tips",
      tips: [
        "Review each scene prompt carefully",
        "Edit the avatar script to match your brand voice",
        "Keep dialogue natural and conversational",
        "Ensure scenes flow logically from one to the next"
      ]
    },
    4: {
      title: "Generation Tips",
      tips: [
        "Generation takes 2-5 minutes per scene",
        "You can track progress on the Dashboard",
        "Failed scenes can be retried individually",
        "Final videos can be stitched together automatically"
      ]
    }
  };

  const currentTips = tips[step];
  if (!currentTips) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <div className="flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-2">
            {currentTips.title}
          </h4>
          <ul className="space-y-1">
            {currentTips.tips.map((tip, index) => (
              <li key={index} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <span className="text-amber-400">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FormTips;
