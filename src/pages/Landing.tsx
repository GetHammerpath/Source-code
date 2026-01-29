import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, ArrowRight, Shield, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { buildPrompts } from "@/lib/nano-banana-prompt-builder";

const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll to pricing when opening /#pricing
  useEffect(() => {
    if (location.hash === "#pricing") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.pathname, location.hash]);

  // Reverse onboarding (Casting Interface) - ALL LOGIC PRESERVED
  const [castingPrompt, setCastingPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [talentName, setTalentName] = useState("");
  
  // Nano Banana Prompt Builder
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [editedPositivePrompt, setEditedPositivePrompt] = useState("");
  const [editedNegativePrompt, setEditedNegativePrompt] = useState("");

  const canGenerate = castingPrompt.trim().length > 0 && !generating;
  const canContinue = !!selectedImageUrl && talentName.trim().length > 0;

  // Auto-generate prompts when user types
  useEffect(() => {
    if (castingPrompt.trim()) {
      const { positive, negative } = buildPrompts(castingPrompt.trim());
      setPositivePrompt(positive);
      setNegativePrompt(negative);
      setEditedPositivePrompt(positive);
      setEditedNegativePrompt(negative);
    } else {
      setPositivePrompt("");
      setNegativePrompt("");
      setEditedPositivePrompt("");
      setEditedNegativePrompt("");
    }
  }, [castingPrompt]);

  const copyToClipboard = async (text: string, type: "positive" | "negative") => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add toast here if needed
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const pendingSignupUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (selectedImageUrl) qs.set("selected_image_url", selectedImageUrl);
    if (talentName.trim()) qs.set("avatar_name", talentName.trim());
    return `/signup?${qs.toString()}`;
  }, [selectedImageUrl, talentName]);

  const generateAvatars = async () => {
    setGenerateError(null);
    setGenerateNotice(null);
    setGenerating(true);
    setGeneratedUrls([]);
    try {
      // Use edited prompt if available, otherwise use auto-generated positive prompt
      const promptToUse = editedPositivePrompt.trim() || positivePrompt.trim() || castingPrompt.trim();
      const res = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToUse }),
      });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string; warning?: string };
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const urls = Array.isArray(data?.urls) ? data.urls.filter(Boolean) : [];
      if (urls.length === 0) throw new Error("No images returned");
      
      // Show warning if using placeholders
      if (data?.warning) {
        setGenerateNotice(data.warning);
      }
      
      setGeneratedUrls(urls.slice(0, 4));
    } catch (e) {
      if (import.meta.env.DEV) {
        const prompt = castingPrompt.trim();
        let h = 7;
        for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) >>> 0;
        const seed = h.toString(16);
        setGeneratedUrls([
          `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}-1&size=1024`,
          `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}-2&size=1024`,
          `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}-3&size=1024`,
          `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}-4&size=1024`,
        ]);
        setGenerateNotice("Dev mode: using local mock generator.");
      } else {
        setGenerateError(e instanceof Error ? e.message : "Failed to generate images");
      }
    } finally {
      setGenerating(false);
    }
  };

  const onPickImage = (url: string) => {
    setSelectedImageUrl(url);
    setTalentName("");
    setNameDialogOpen(true);
  };

  const onSignupBridge = () => {
    if (!canContinue || !selectedImageUrl) return;
    localStorage.setItem(
      "hp:pending_avatar",
      JSON.stringify({ selected_image_url: selectedImageUrl, avatar_name: talentName.trim() })
    );
    navigate(pendingSignupUrl);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section id="solutions" className="relative bg-slate-50 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url(/images/hero_nano_banana.png)" }}>
        <div className="absolute inset-0 bg-white/80 z-0" aria-hidden />
        <div className="container mx-auto px-6 md:px-8 py-20 md:py-32 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Left Column: Headline */}
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              The Infrastructure for Infinite Identity
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed">
              Generate <strong className="text-slate-900">2,000+ unique, consistent avatars</strong> in minutes. Solve ad fatigue with programmatic video creation that scales.
            </p>
          </div>

          {/* Right Column: Casting Interface Widget (Terminal Card) */}
          <div className="bg-white border border-slate-200 rounded-md shadow-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span className="ml-2 text-xs font-mono text-slate-500">casting-interface</span>
                </div>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                  Nano Banana Pro
                </span>
              </div>

              <div className="space-y-3">
                <Label htmlFor="casting-prompt" className="text-sm font-medium text-slate-900">
                  Describe your ideal spokesperson
                </Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    id="casting-prompt"
                    value={castingPrompt}
                    onChange={(e) => setCastingPrompt(e.target.value)}
                    placeholder="e.g. photorealistic portrait, professional headshot, realistic spokesperson..."
                    className="rounded-md h-10 border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Button
                    onClick={generateAvatars}
                    disabled={!canGenerate}
                    className="bg-[#002FA7] hover:bg-[#002080] text-white rounded-md h-10 px-6 shadow-sm"
                  >
                    {generating ? "Generating..." : "Generate"}
                  </Button>
                </div>
                {generateError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{generateError}</div>
                )}
                {generateNotice && !generateError && (
                  <div className={`text-xs p-2 rounded-md border ${
                    generateNotice.includes("placeholder") || generateNotice.includes("KIE_AI_API_TOKEN")
                      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    {generateNotice}
                  </div>
                )}
                {positivePrompt && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedPrompt(!showAdvancedPrompt)}
                      className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900"
                    >
                      <span>Advanced Prompt Editor</span>
                      {showAdvancedPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showAdvancedPrompt && (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-slate-700">POSITIVE_PROMPT</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => copyToClipboard(editedPositivePrompt, "positive")}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <Textarea
                            value={editedPositivePrompt}
                            onChange={(e) => setEditedPositivePrompt(e.target.value)}
                            className="text-xs font-mono min-h-[80px] border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Auto-generated prompt..."
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-slate-700">NEGATIVE_PROMPT</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => copyToClipboard(editedNegativePrompt, "negative")}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <Textarea
                            value={editedNegativePrompt}
                            onChange={(e) => setEditedNegativePrompt(e.target.value)}
                            className="text-xs font-mono min-h-[60px] border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Auto-generated negative prompt..."
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          Prompts auto-filled from your description. Edit as needed. The positive prompt will be used for generation.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Tip: Try short descriptions like &quot;black cowboy&quot; or &quot;female chef&quot;. The prompt builder will auto-fill details.
                </p>
              </div>

              {generatedUrls.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-md inline-block">
                    Photorealistic Avatar (Nano Banana Engine)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {generatedUrls.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => onPickImage(url)}
                        className="group relative overflow-hidden rounded-md border border-slate-200 hover:shadow-md transition-all"
                      >
                        <img
                          src={url}
                          alt="Generated avatar option"
                          className="h-32 w-full object-cover group-hover:scale-[1.02] transition-transform"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="platform" className="bg-slate-50 py-20 md:py-32">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-12">
              DiuDiu vs. HeyGen / Synthesia
            </h2>
            <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4 font-semibold text-slate-900">Feature</th>
                    <th className="text-center p-4 font-semibold text-slate-900">DiuDiu</th>
                    <th className="text-center p-4 font-semibold text-slate-900">HeyGen</th>
                    <th className="text-center p-4 font-semibold text-slate-900">Synthesia</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Infinite Identity Creation", diudiu: true, heygen: false, synthesia: false },
                    { feature: "Enterprise-Grade Infrastructure", diudiu: true, heygen: false, synthesia: true },
                    { feature: "API-First Architecture", diudiu: true, heygen: true, synthesia: false },
                    { feature: "Multi-Provider Support", diudiu: true, heygen: false, synthesia: false },
                    { feature: "Golden Sample Safety Gates", diudiu: true, heygen: false, synthesia: false },
                    { feature: "Bulk Processing", diudiu: true, heygen: true, synthesia: true },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-200 last:border-b-0">
                      <td className="p-4 text-slate-900">{row.feature}</td>
                      <td className="p-4 text-center">
                        {row.diudiu ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-red-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.heygen ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-red-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.synthesia ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-red-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 scroll-mt-20">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-12">
              Simple, Transparent Pricing
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Pay-as-you-go */}
              <div className="bg-white border border-slate-200 rounded-md shadow-sm p-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Pay-as-you-go</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">$3.34</span>
                  <span className="text-slate-600">/segment</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["1 credit = 1 segment", "No monthly minimums", "Credits never expire", "Automatic refunds on failures"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/checkout?mode=credits")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  Buy Credits
                </Button>
              </div>

              {/* Agency Batch */}
              <div className="bg-white border-2 border-blue-600 rounded-md shadow-sm p-8">
                <div className="text-xs font-semibold text-blue-600 mb-2">POPULAR</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Agency Batch</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">Custom</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Bulk processing", "Golden Sample gates", "API access", "Priority support", "Custom integrations"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/auth")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  Contact Sales
                </Button>
              </div>

              {/* Studio Access */}
              <div className="bg-white border border-slate-200 rounded-md shadow-sm p-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Studio Access</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">$99</span>
                  <span className="text-slate-600">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Full studio UI", "Workflow management", "Team collaboration", "Compliance tooling"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/checkout?mode=access")}
                  variant="outline"
                  className="w-full border-slate-300 rounded-md"
                >
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 bg-white">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-lg tracking-tight text-slate-900">DiuDiu</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <button type="button" onClick={() => navigate("/api-keys")} className="hover:text-slate-900 transition-colors">
                API Docs
              </button>
              <button type="button" onClick={() => navigate("/auth")} className="hover:text-slate-900 transition-colors">
                Login
              </button>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} DiuDiu. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Name Your Talent Dialog - PRESERVED */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="rounded-md">
          <DialogHeader>
            <DialogTitle>Name Your Talent</DialogTitle>
            <DialogDescription>
              Give your spokesperson a name. We'll save it to your account after signup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedImageUrl && (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <img src={selectedImageUrl} alt="Selected avatar" className="w-full h-56 object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="talent-name">Talent name</Label>
              <Input
                id="talent-name"
                value={talentName}
                onChange={(e) => setTalentName(e.target.value)}
                placeholder="e.g. Mike"
                className="rounded-md border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-md border-slate-300"
              onClick={() => setNameDialogOpen(false)}
            >
              Not now
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              disabled={!canContinue}
              onClick={onSignupBridge}
            >
              Sign up to hire {talentName.trim() ? `"${talentName.trim()}"` : "your talent"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;
