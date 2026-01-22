import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudioHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryActions?: ReactNode;
  className?: string;
}

const StudioHeader = ({ 
  title, 
  subtitle, 
  primaryAction, 
  secondaryActions,
  className 
}: StudioHeaderProps) => {
  return (
    <div className={cn("border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10", className)}>
      <div className="flex items-center justify-between px-6 md:px-8 py-6 md:py-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1.5">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3 ml-6">
          {secondaryActions}
          {primaryAction && (
            <Button 
              onClick={primaryAction.onClick}
              className="rounded-[14px] font-medium shadow-sm hover:shadow-md transition-all duration-150"
            >
              {primaryAction.icon && <span className="mr-2">{primaryAction.icon}</span>}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioHeader;
