import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const AdminPageHeader = ({ title, subtitle, actions }: AdminPageHeaderProps) => {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Link to="/admin" className="hover:text-foreground transition-colors">
          Admin
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{title}</span>
      </div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
