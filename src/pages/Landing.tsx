import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Wand2, Film, Zap, Sparkles, Layers, Check, Play, 
  ArrowRight, Video, Users, Clock, Shield, Star, Menu,
  Workflow, Settings, CheckCircle2, FileText, List, Rocket,
  Database, Webhook, Link2, GitBranch, Globe
} from "lucide-react";
import { PRICE_PER_CREDIT, CREDITS_PER_MINUTE } from "@/lib/billing/pricing";

const Landing = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState("ingest");
  const starterCredits = 3;
  const starterTotal = starterCredits * PRICE_PER_CREDIT;

  // Reverse onboarding (Casting Interface)
  const [castingPrompt, setCastingPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [talentName, setTalentName] = useState("");

  const canGenerate = castingPrompt.trim().length > 0 && !generating;
  const canContinue = !!selectedImageUrl && talentName.trim().length > 0;

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
      const res = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: castingPrompt.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const urls = Array.isArray(data?.urls) ? data.urls.filter(Boolean) : [];
      if (urls.length === 0) throw new Error("No images returned");
      setGeneratedUrls(urls.slice(0, 4));
    } catch (e) {
      // Dev convenience: Vite doesn't run Vercel serverless functions.
      // If /api isn't available locally, fall back to a deterministic client-side mock.
      if (import.meta.env.DEV) {
        const prompt = castingPrompt.trim();
        let h = 7;
        for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) >>> 0;
        const seed = h.toString(16);
        setGeneratedUrls([
          `https://picsum.photos/seed/${seed}-1/1024/1024`,
          `https://picsum.photos/seed/${seed}-2/1024/1024`,
          `https://picsum.photos/seed/${seed}-3/1024/1024`,
          `https://picsum.photos/seed/${seed}-4/1024/1024`,
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
    // Persist bridge data (in addition to URL params)
    localStorage.setItem(
      "hp:pending_avatar",
      JSON.stringify({ selected_image_url: selectedImageUrl, avatar_name: talentName.trim() })
    );
    navigate(pendingSignupUrl);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
                <Video className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight">Video Portal</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection("features")} className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                Features
              </button>
              <button onClick={() => scrollToSection("how-it-works")} className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                How it Works
              </button>
              <button onClick={() => scrollToSection("integrations")} className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                Integrations
              </button>
              <button onClick={() => scrollToSection("pricing")} className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                Pricing
              </button>
              <button onClick={() => scrollToSection("faq")} className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                FAQ
              </button>
            </div>

            <div className="flex items-center gap-4">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <div className="flex flex-col gap-4 mt-8">
                    <button onClick={() => scrollToSection("features")} className="text-left text-base font-medium text-foreground hover:text-foreground/80 transition-colors">
                      Features
                    </button>
                    <button onClick={() => scrollToSection("how-it-works")} className="text-left text-base font-medium text-foreground hover:text-foreground/80 transition-colors">
                      How it Works
                    </button>
                    <button onClick={() => scrollToSection("integrations")} className="text-left text-base font-medium text-foreground hover:text-foreground/80 transition-colors">
                      Integrations
                    </button>
                    <button onClick={() => scrollToSection("pricing")} className="text-left text-base font-medium text-foreground hover:text-foreground/80 transition-colors">
                      Pricing
                    </button>
                    <button onClick={() => scrollToSection("faq")} className="text-left text-base font-medium text-foreground hover:text-foreground/80 transition-colors">
                      FAQ
                    </button>
                    <Button onClick={() => navigate("/auth")} className="mt-4 rounded-[14px]">
                      Get Started
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <Button onClick={() => navigate("/auth")} className="hidden md:flex rounded-[14px] shadow-sm hover:shadow-md transition-all duration-150">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
              The Casting Interface
            </h1>
            <p className="text-lg text-muted-foreground">
              Generate an avatar before you sign up. Pick a look, name your talent, then create your account.
            </p>
          </div>

          <div className="text-left space-y-3">
            <Label htmlFor="casting-prompt" className="text-sm font-medium">
              Describe your ideal spokesperson
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="casting-prompt"
                value={castingPrompt}
                onChange={(e) => setCastingPrompt(e.target.value)}
                placeholder="e.g. confident, friendly, modern, studio lighting, clean background..."
                className="rounded-[14px] h-12"
              />
              <Button
                onClick={generateAvatars}
                disabled={!canGenerate}
                className="rounded-[14px] h-12 px-6"
              >
                {generating ? "Generating..." : "Generate"}
              </Button>
            </div>
            {generateError && (
              <div className="text-sm text-destructive">
                {generateError}
              </div>
            )}
            {generateNotice && !generateError && (
              <div className="text-xs text-muted-foreground">
                {generateNotice}
              </div>
            )}
          </div>

          {generatedUrls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {generatedUrls.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onPickImage(url)}
                  className="group relative overflow-hidden rounded-[14px] border border-border/50 bg-muted/20 hover:shadow-md transition-all duration-150"
                >
                  <img
                    src={url}
                    alt="Generated avatar option"
                    className="h-40 w-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              ))}
            </div>
          )}

          <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            No signup required to generate. Sign up only when you’re ready to hire.
          </div>
        </div>

        <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
          <DialogContent className="rounded-[14px]">
            <DialogHeader>
              <DialogTitle>Name Your Talent</DialogTitle>
              <DialogDescription>
                Give your spokesperson a name. We’ll save it to your account after signup.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedImageUrl && (
                <div className="overflow-hidden rounded-[14px] border border-border/50">
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
                  className="rounded-[14px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                className="rounded-[14px]"
                onClick={() => setNameDialogOpen(false)}
              >
                Not now
              </Button>
              <Button
                className="rounded-[14px]"
                disabled={!canContinue}
                onClick={onSignupBridge}
              >
                Sign up to hire {talentName.trim() ? `"${talentName.trim()}"` : "your talent"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Logo Strip */}
      <section className="border-y border-border/40 py-12">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
            {["Acme Inc", "TechCorp", "StartupXYZ", "BrandCo", "InnovateLabs", "FutureMedia"].map((name, i) => (
              <div key={i} className="text-sm font-medium text-muted-foreground">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Everything for long-form production</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Orchestrate complex workflows with compliance and quality controls
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Film, title: "Long-Form Generation", desc: "Create videos from minutes to hours with multi-scene orchestration" },
            { icon: Workflow, title: "Scene Orchestration", desc: "Automatically break scripts into scenes, shots, and sequences" },
            { icon: Settings, title: "Provider Routing", desc: "Choose Kie or custom providers per scene for optimal results" },
            { icon: Shield, title: "Compliance Modes", desc: "Brand-safe generation with rights-safe prompts and no-logo options" },
            { icon: CheckCircle2, title: "Quality Gates", desc: "Preview, retry, and consistency checks before final render" },
            { icon: Database, title: "Asset Library", desc: "Centralized voice, music, b-roll, and caption assets" },
            { icon: Users, title: "Team Collaboration", desc: "Role-based access, approvals, and collaborative workflows" },
            { icon: Rocket, title: "Export & Publish", desc: "Multiple formats, aspect ratios, and direct delivery options" },
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-[14px] border border-border/50 bg-card hover:shadow-md transition-all duration-150">
              <div className="h-12 w-12 rounded-[14px] bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/30 py-20 md:py-32">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">How it works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From script to finished long-form video in four steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {/* Steps */}
            <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="ingest" className="text-xs">1. Ingest</TabsTrigger>
                <TabsTrigger value="storyboard" className="text-xs">2. Storyboard</TabsTrigger>
                <TabsTrigger value="render" className="text-xs">3. Render</TabsTrigger>
                <TabsTrigger value="assemble" className="text-xs">4. Assemble</TabsTrigger>
              </TabsList>

              <TabsContent value="ingest" className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Ingest</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Upload your script, outline, podcast transcript, or blog URL. Our system understands context and intent, automatically structuring your content for video production.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Script parsing & analysis
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Multi-format input support
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Automatic content structuring
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="storyboard" className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Storyboard</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    AI automatically breaks your content into scenes and shot lists. Assign styles, select providers per scene, and preview before rendering.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Auto scene generation
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Shot list & style assignment
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Provider selection per scene
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="render" className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Render</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Orchestrate rendering across providers with intelligent queue management. Automatic retries, quality checks, and consistency validation.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Multi-provider orchestration
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Intelligent queue management
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Automatic retries & quality gates
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="assemble" className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Assemble</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Final timeline assembly with captions, audio mixing, and transitions. Export in any format or deliver directly to your platforms.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Timeline editing
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Captions & audio mixing
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Multi-format export
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Mock Panel */}
            <div className="rounded-[20px] bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 p-6 border border-border/50 shadow-lg">
              <div className="bg-muted/40 rounded-[14px] backdrop-blur-sm border border-border/50 p-6 space-y-6 min-h-[400px]">
                {activeStep === "ingest" && (
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-muted-foreground">Input Sources</div>
                    <div className="space-y-2">
                      <div className="p-3 bg-background/50 rounded-[8px] border border-border/30 text-sm">
                        📄 Script: Founder Story.docx
                      </div>
                      <div className="p-3 bg-background/50 rounded-[8px] border border-border/30 text-sm">
                        🎙️ Podcast: Episode 23.mp3
                      </div>
                      <div className="p-3 bg-background/50 rounded-[8px] border border-border/30 text-sm">
                        🔗 URL: https://blog.example.com/post
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === "storyboard" && (
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-muted-foreground">Scene Breakdown (18 scenes)</div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded-[8px] border border-border/30">
                          <div className="w-6 text-center font-medium text-muted-foreground">{i}</div>
                          <div className="flex-1 text-foreground/80">Scene {i}: {i === 1 ? "Opening hook" : i === 2 ? "Problem statement" : i === 3 ? "Solution intro" : "Content continuation"}</div>
                          <div className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                            Kie
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeStep === "render" && (
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-muted-foreground">Render Queue</div>
                    <div className="space-y-2">
                      <div className="p-3 bg-background/50 rounded-[8px] border border-primary/30">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="text-sm font-medium">Scene 5/18</span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-3.5">Rendering via Kie...</div>
                      </div>
                      <div className="p-3 bg-background/50 rounded-[8px] border border-border/30 opacity-60">
                        <div className="text-sm font-medium mb-1">Scene 6/18</div>
                        <div className="text-xs text-muted-foreground">Queued (Kie)</div>
                      </div>
                      <div className="p-3 bg-background/50 rounded-[8px] border border-border/30 opacity-60">
                        <div className="text-sm font-medium mb-1">Scene 7/18</div>
                        <div className="text-xs text-muted-foreground">Queued (Kie)</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === "assemble" && (
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-muted-foreground">Timeline</div>
                    <div className="space-y-2">
                      <div className="h-12 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[8px] border border-border/30 flex items-center px-3">
                        <span className="text-xs font-medium">Scene 1-3 (0:00-2:15)</span>
                      </div>
                      <div className="h-12 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[8px] border border-border/30 flex items-center px-3">
                        <span className="text-xs font-medium">Scene 4-6 (2:15-4:30)</span>
                      </div>
                      <div className="h-12 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[8px] border border-border/30 flex items-center px-3">
                        <span className="text-xs font-medium">Scene 7-9 (4:30-6:45)</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border/30 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-muted-foreground">Captions added</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-muted-foreground">Audio mixed</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-muted-foreground">Ready for export</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="container mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Works with your stack</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Provider-agnostic by design. Orchestrate across multiple AI video services.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { 
              name: "Kie.ai", 
              desc: "Video generation and upscaling provider",
              capabilities: ["Video generation", "Upscaling", "Scene extension"]
            },
            { 
              name: "Bring Your Own Model", 
              desc: "Integrate custom providers via API",
              capabilities: ["Custom endpoints", "API routing", "Flexible integration"]
            },
            { 
              name: "Storage: S3/GCS", 
              desc: "Cloud storage integration",
              capabilities: ["Asset storage", "Direct uploads", "CDN delivery"]
            },
            { 
              name: "Automation: Webhooks", 
              desc: "Event-driven workflows",
              capabilities: ["n8n integration", "Zapier support", "Custom webhooks"]
            },
            { 
              name: "Video Platforms", 
              desc: "Direct publishing integrations",
              capabilities: ["YouTube", "Vimeo", "Custom delivery"]
            },
          ].map((integration, i) => (
            <div key={i} className="p-6 rounded-[14px] border border-border/50 bg-card hover:shadow-md transition-all duration-150">
              <div className="h-10 w-10 rounded-[14px] bg-primary/10 flex items-center justify-center mb-4">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{integration.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{integration.desc}</p>
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground mb-2">Capabilities:</div>
                {integration.capabilities.map((cap, j) => (
                  <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    {cap}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Need a different provider? <button className="text-primary hover:underline">Contact us</button> for custom integrations.
          </p>
        </div>
      </section>

      {/* Showcase */}
      <section className="bg-muted/30 py-20 md:py-32">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Real long-form outcomes</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See what teams are creating with Video Portal
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: "12-minute Founder Story", desc: "Multi-scene narrative with brand-safe compliance" },
              { title: "8-minute Local Service Explainer", desc: "Educational content with consistent style" },
              { title: "30-minute Training Module", desc: "Long-form instructional video with captions" },
            ].map((showcase, i) => (
              <div key={i} className="rounded-[14px] border border-border/50 overflow-hidden bg-card hover:shadow-md transition-all duration-150">
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center relative">
                  <Film className="h-12 w-12 text-primary/40" />
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-background/90 rounded text-[10px] font-medium text-foreground">
                    {i === 0 ? "12:34" : i === 1 ? "8:15" : "30:42"}
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">Case Study</p>
                  <p className="font-semibold mb-2">{showcase.title}</p>
                  <p className="text-sm text-muted-foreground">{showcase.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Trusted by production teams</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { name: "Sarah Chen", role: "Marketing Director", quote: "We produce hours of training content monthly. The orchestration layer makes it seamless." },
            { name: "Marcus Johnson", role: "Content Producer", quote: "Being able to switch providers per scene gives us optimal results without vendor lock-in." },
            { name: "Emily Rodriguez", role: "Creative Lead", quote: "Compliance-safe generation means we can scale production without legal concerns." },
          ].map((testimonial, i) => (
            <div key={i} className="p-6 rounded-[14px] border border-border/50 bg-card">
              <div className="flex items-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4">"{testimonial.quote}"</p>
              <div>
                <p className="font-semibold text-sm">{testimonial.name}</p>
                <p className="text-xs text-muted-foreground">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-muted/30 py-20 md:py-32">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Simple, pay-as-you-go pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Studio Access subscription + credits for video rendering
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Studio Access */}
            <div className="p-8 rounded-[14px] border-2 border-primary/20 bg-card shadow-lg hover:shadow-xl transition-all duration-150">
              <div className="text-xs font-semibold text-primary mb-2">REQUIRED</div>
              <h3 className="text-2xl font-semibold mb-2">Studio Access</h3>
              <div className="mb-6">
                <span className="text-4xl font-semibold">$99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Unlock the studio (orchestration UI, integrations, team workflows)
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Studio & orchestration UI",
                  "Provider integrations framework",
                  "Team collaboration tools",
                  "Compliance tooling",
                  "Workflow management",
                  "Quality gates & retries"
                ].map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-muted-foreground mb-4">
                Studio Access includes 0 credits. Credits are purchased separately.
              </div>
              <Button 
                onClick={() => navigate("/checkout?mode=access")} 
                className="w-full rounded-[14px]"
              >
                Subscribe to Studio Access
              </Button>
            </div>

            {/* Credits */}
            <div className="p-8 rounded-[14px] border border-border/50 bg-card hover:shadow-md transition-all duration-150">
              <h3 className="text-2xl font-semibold mb-2">Credits</h3>
              <div className="mb-6">
                <span className="text-4xl font-semibold">${starterTotal.toFixed(2)}</span>
                <span className="text-muted-foreground">/{starterCredits} segments</span>
                <div className="text-xs text-muted-foreground mt-1">
                  ${PRICE_PER_CREDIT.toFixed(2)} per segment credit
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Pay-as-you-go credits for video rendering
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "1 credit = 1 segment",
                  "Credits never expire",
                  "Buy what you need",
                  "No monthly minimums",
                  "Provider-agnostic",
                  "Automatic refunds on failed renders"
                ].map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate("/checkout?mode=credits")} 
                variant="outline"
                className="w-full rounded-[14px]"
              >
                Buy Credits
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="max-w-3xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Frequently asked questions</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {[
              { q: "How long can videos be?", a: "Videos can range from a few minutes to hours. Our system is designed for long-form content with multi-scene orchestration, typically producing 5-60 minute videos, though longer formats are supported." },
              { q: "Which providers do you support?", a: "We integrate with Kie.ai and other major AI video providers. You can also bring your own model via API. Our architecture is provider-agnostic, allowing you to use Kie or custom providers per scene." },
              { q: "Can I switch providers per scene?", a: "Yes. Each scene can be assigned to Kie or a custom provider you've integrated." },
              { q: "How do you handle consistency across scenes?", a: "Our quality gates and consistency checks ensure visual and narrative coherence. We maintain style continuity, color matching, and pacing across all scenes, regardless of which provider rendered them." },
              { q: "What does compliance-safe mean?", a: "Compliance-safe generation means we support brand-safe prompts, rights-safe content generation, and no-logo options. Our system helps ensure generated content meets legal and brand guidelines, with configurable compliance rules." },
              { q: "Do you store prompts and assets?", a: "Yes, we maintain an asset library including voice samples, music, b-roll, and prompts. All data is stored securely and can be managed through our team collaboration features. You can also use your own storage (S3/GCS) for assets." },
              { q: "How does the orchestration layer work?", a: "The orchestration layer manages workflows across providers—queuing renders, handling retries, ensuring quality gates pass, and assembling the final timeline. It abstracts provider-specific details so you focus on content, not infrastructure." },
              { q: "What formats can I export to?", a: "We support all major video formats (MP4, MOV, WebM) and aspect ratios (16:9, 9:16, 1:1, etc.). You can export at various resolutions including HD, 4K, and custom dimensions based on your needs." },
            ].map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-border/50 rounded-[14px] px-6 bg-card">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-muted/30 py-20 md:py-32">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8 p-12 rounded-[20px] border border-border/50 bg-gradient-to-br from-primary/5 to-accent/5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Ready to create long-form videos at scale?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join production teams using Video Portal for orchestrated, compliance-safe video generation.
            </p>
            <Button 
              onClick={() => navigate("/auth")} 
              size="lg"
              className="rounded-[14px] shadow-sm hover:shadow-md transition-all duration-150 text-base px-8 h-12"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
                <Video className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight">Video Portal</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <button className="hover:text-foreground transition-colors">Privacy</button>
              <button className="hover:text-foreground transition-colors">Terms</button>
              <button className="hover:text-foreground transition-colors">Support</button>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Video Portal. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
