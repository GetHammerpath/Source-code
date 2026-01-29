import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

const PUBLIC_ROUTES = ["/", "/pricing", "/auth", "/signup", "/checkout/success", "/checkout/cancel"];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!PUBLIC_ROUTES.includes(location.pathname)) return null;

  const nav = (mobile = false) => (
    <>
      <button
        type="button"
        onClick={() => {
          navigate("/pricing");
          if (mobile) setMobileMenuOpen(false);
        }}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        Pricing
      </button>
      <button
        type="button"
        onClick={() => {
          navigate("/auth");
          if (mobile) setMobileMenuOpen(false);
        }}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        Login
      </button>
      <Button
        onClick={() => {
          navigate("/auth");
          if (mobile) setMobileMenuOpen(false);
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm"
      >
        Get Started
      </Button>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto px-6 md:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-semibold text-lg tracking-tight text-slate-900 hover:text-slate-700 transition-colors"
            >
              DiuDiu
            </button>
          </div>

          <div className="hidden md:flex items-center gap-8">{nav()}</div>

          <div className="flex items-center gap-4 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col gap-4 mt-8">{nav(true)}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
