/**
 * Phase 5: Image tips for best results - reusable expandable section
 */
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useState } from "react";

const TIPS = [
  "Clear face, good lighting, neutral background",
  "Person centered, medium shot (waist up or full body)",
  "Avoid: heavy shadows, sunglasses, busy backgrounds, multiple people",
  "Recommended: high resolution (min 512px), well-lit, professional attire if applicable",
];

export function ImageTips({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Info className="h-3.5 w-3.5" />
        Image tips for best results
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 text-xs text-muted-foreground space-y-1 pl-4 list-disc">
          {TIPS.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
