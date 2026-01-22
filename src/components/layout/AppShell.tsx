import { ReactNode } from "react";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface AppShellProps {
  children: ReactNode;
  showRightPanel?: boolean;
  rightPanelContent?: ReactNode;
  sidebarCollapsed?: boolean;
}

const AppShell = ({ children, showRightPanel = false, rightPanelContent }: AppShellProps) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <aside className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navigation */}
        <TopNav />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="h-full w-full">
              {children}
            </div>
          </main>

          {/* Right Panel (Optional - for Runway-like inspector) */}
          {showRightPanel && rightPanelContent && (
            <aside className="hidden lg:flex w-80 border-l border-border bg-muted/30 overflow-y-auto">
              {rightPanelContent}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppShell;
