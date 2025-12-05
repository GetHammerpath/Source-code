import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";

type Status = "queued" | "processing" | "completed" | "failed";

interface StatusBadgeProps {
  status: Status;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config: Record<Status, { label: string; icon: any; className: string; animate?: boolean }> = {
    queued: {
      label: "Queued",
      icon: Clock,
      className: "bg-muted text-muted-foreground",
    },
    processing: {
      label: "Processing",
      icon: Loader2,
      className: "bg-primary text-primary-foreground",
      animate: true,
    },
    completed: {
      label: "Completed",
      icon: CheckCircle2,
      className: "bg-success text-success-foreground",
    },
    failed: {
      label: "Failed",
      icon: XCircle,
      className: "bg-destructive text-destructive-foreground",
    },
  };

  const { label, icon: Icon, className, animate } = config[status];

  return (
    <Badge className={className}>
      <Icon className={`h-3 w-3 mr-1 ${animate ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
};

export default StatusBadge;
