import { Search, Bell, Menu, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";
import { useCredits } from "@/hooks/useCredits";

const TopNav = ({ onSidebarToggle }: { onSidebarToggle?: () => void }) => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("");
  const { balance } = useCredits();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        const initials = user.email
          .split("@")[0]
          .split(".")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        setUserInitials(initials || "U");
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        {/* Left: Logo + App Name */}
        <div className="flex items-center gap-3 flex-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <img src="/images/suosuo_logo.png" alt="Suosuo" className="h-8 w-8 object-contain flex-shrink-0" />
            <span className="font-semibold text-lg tracking-tight hidden sm:inline-block">Suosuo</span>
          </button>
        </div>

        {/* Center: Search (optional, hidden on mobile) */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 h-9 bg-muted/50 border-border/50 focus:bg-background"
            />
          </div>
        </div>

        {/* Right: Credit Balance + Notifications + User Menu */}
        <div className="flex items-center gap-2">
          {/* Credit Balance Indicator */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/account/billing")}
            className="hidden md:flex items-center gap-2 h-9 rounded-[10px] border-primary/20 hover:bg-primary/5"
          >
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">
              {balance?.credits.toLocaleString() || "0"} credits
            </span>
          </Button>

          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Bell className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Account</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/templates")}>
                Templates
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/account/billing")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing & Credits
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
