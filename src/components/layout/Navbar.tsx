import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_ROUTES = ["/", "/pricing", "/auth", "/signup", "/checkout/success", "/checkout/cancel"];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  if (!PUBLIC_ROUTES.includes(location.pathname)) return null;

  const scrollTo = (id: string) => {
    if (location.pathname === "/") document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    else navigate(`/#${id}`);
    setMobileMenuOpen(false);
  };
  const goAuth = () => { navigate("/auth"); setMobileMenuOpen(false); };
  const goHome = () => {
    setMobileMenuOpen(false);
    navigate(isAuthenticated ? "/dashboard" : "/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto px-6 md:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={goHome} className="flex items-center">
              <img src="/images/suosuo_logo.png" alt="Suosuo" className="h-8 w-auto object-contain" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button type="button" onClick={() => scrollTo("solutions")} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Solutions</button>
            <button type="button" onClick={() => scrollTo("why")} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Why Suosuo</button>
            <button type="button" onClick={() => scrollTo("platform")} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Platform</button>
            <button type="button" onClick={() => scrollTo("pricing")} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</button>
            <Button onClick={() => navigate("/auth")} className="bg-[#002FA7] hover:bg-[#002080] text-white rounded-md shadow-sm">Start Generating</Button>
          </div>

          <div className="flex items-center gap-4 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col gap-4 mt-8">
                  <button type="button" onClick={() => scrollTo("solutions")} className="text-sm font-medium text-slate-600 hover:text-slate-900 text-left">Solutions</button>
                  <button type="button" onClick={() => scrollTo("why")} className="text-sm font-medium text-slate-600 hover:text-slate-900 text-left">Why Suosuo</button>
                  <button type="button" onClick={() => scrollTo("platform")} className="text-sm font-medium text-slate-600 hover:text-slate-900 text-left">Platform</button>
                  <button type="button" onClick={() => scrollTo("pricing")} className="text-sm font-medium text-slate-600 hover:text-slate-900 text-left">Pricing</button>
                  <Button onClick={goAuth} className="bg-[#002FA7] hover:bg-[#002080] text-white rounded-md shadow-sm justify-start">Start Generating</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
