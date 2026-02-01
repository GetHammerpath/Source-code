import { motion } from "framer-motion";
import { FileSpreadsheet, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type StrategyChoice = "csv" | "ai" | "spinner" | null;

const PRO_TIPS: Record<NonNullable<StrategyChoice>, string> = {
  csv: "Pro Tip: CSV is best for strict brand guidelines. You control every script and avatar pairing.",
  ai: "Pro Tip: AI works great when you have a clear theme. The model will generate variations from your topic.",
  spinner: "Pro Tip: Spinner helps discover new avatars. Perfect for testing which talent resonates with your audience.",
};

interface Step1_StrategyProps {
  selected: StrategyChoice;
  onSelect: (choice: StrategyChoice) => void;
}

export function Step1_Strategy({ selected, onSelect }: Step1_StrategyProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold mb-2">How do you want to build your campaign?</h2>
        <p className="text-muted-foreground">
          Choose your starting point. You can always refine in the next step.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StrategyCard
          icon={FileSpreadsheet}
          title="CSV Upload"
          description="I have a plan. Upload specific scripts/avatars."
          selected={selected === "csv"}
          onClick={() => onSelect("csv")}
        />
        <StrategyCard
          icon={Sparkles}
          title="AI Generator"
          description="I have an idea. Generate variations from a topic."
          selected={selected === "ai"}
          onClick={() => onSelect("ai")}
        />
        <StrategyCard
          icon={Users}
          title="Avatar Spinner"
          description="I need inspiration. Browse the casting library."
          selected={selected === "spinner"}
          onClick={() => onSelect("spinner")}
        />
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border bg-muted/50 p-4"
        >
          <p className="text-sm font-medium text-muted-foreground">{PRO_TIPS[selected]}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

function StrategyCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start p-6 rounded-xl border-2 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <Icon className="h-10 w-10 mb-4 text-primary" />
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </button>
  );
}
