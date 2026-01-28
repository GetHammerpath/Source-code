import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowRight, CreditCard } from "lucide-react";
import { STUDIO_ACCESS, PRICE_PER_CREDIT, CREDITS_PER_MINUTE } from "@/lib/billing/pricing";
import { useStudioAccess } from "@/hooks/useStudioAccess";
import { useCredits } from "@/hooks/useCredits";
import { Badge } from "@/components/ui/badge";
import StudioHeader from "@/components/layout/StudioHeader";
import { supabase } from "@/integrations/supabase/client";

const Pricing = () => {
  const navigate = useNavigate();
  const [subscribing, setSubscribing] = useState(false);
  const { subscription } = useStudioAccess();
  const { balance } = useCredits();
  const secondsPerCredit = 60 / CREDITS_PER_MINUTE;
  const starterCredits = 3;
  const starterTotal = starterCredits * PRICE_PER_CREDIT;
  const tenPackCredits = 10;
  const tenPackTotal = tenPackCredits * PRICE_PER_CREDIT;

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/pricing");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !anonKey) {
        alert("Missing Supabase config (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Configure in Vercel env.");
        return;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ mode: "subscription", planId: "studio_access" }),
      });

      const raw = await res.text();
      let data: { url?: string; error?: string; details?: unknown } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        if (!res.ok) {
          const preview = raw.slice(0, 200).replace(/\n/g, " ");
          throw new Error(`Edge Function error (${res.status}). Response not JSON. Preview: ${preview}`);
        }
      }

      if (!res.ok) {
        const msg = data?.error || `Edge Function error (${res.status})`;
        const details = data?.details ? `\n\nDetails: ${JSON.stringify(data.details)}` : "";
        throw new Error(`${msg}${details}`);
      }

      if (data?.error) throw new Error(data.error);
      if (!data?.url) {
        throw new Error("No checkout URL returned. Check STUDIO_ACCESS_PRICE_ID and Edge Function logs.");
      }

      window.location.href = data.url;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error creating checkout session:", error);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wzpswnuteisyxxwlnqrn.supabase.co";
      alert(
        `Failed to start checkout: ${msg}\n\n` +
          `Logs: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions/create-checkout-session/logs\n\n` +
          `Verify secrets: ${supabaseUrl}/functions/v1/create-checkout-session`
      );
    } finally {
      setSubscribing(false);
    }
  };

  const handleBuyCredits = () => {
    navigate("/checkout?mode=credits");
  };

  return (
    <div className="h-full w-full bg-background">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-12">
        <StudioHeader
          title="Pricing"
          subtitle="Studio Access subscription + pay-as-you-go credits"
        />

        <div className="space-y-12">
          {/* Studio Access */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Studio Access</h2>
              <p className="text-muted-foreground">
                Monthly subscription to unlock the studio features
              </p>
            </div>

            <Card className="rounded-[14px] border-2 border-primary/20 shadow-lg max-w-2xl">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-3xl">{STUDIO_ACCESS.name}</CardTitle>
                  <Badge variant="default" className="text-sm">
                    Required
                  </Badge>
                </div>
                <CardDescription className="text-lg">
                  {STUDIO_ACCESS.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${STUDIO_ACCESS.price}</span>
                  <span className="text-muted-foreground text-lg">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Studio Access includes 0 credits. Credits are purchased separately.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {STUDIO_ACCESS.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleSubscribe}
                  disabled={subscription?.status === "active" || subscribing}
                  className="w-full rounded-[14px]"
                  size="lg"
                >
                  {subscription?.status === "active" ? (
                    "Studio Access Active"
                  ) : subscribing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Subscribe to Studio Access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Credits */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Credits - Pay as you go</h2>
              <p className="text-muted-foreground">
                Buy credits when you need them. Credits are used for rendering videos.
              </p>
            </div>

            <Card className="rounded-[14px] max-w-2xl">
              <CardHeader>
                <CardTitle>Credit Pricing</CardTitle>
                <CardDescription>
                  Credits are consumed when rendering videos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-[10px]">
                    <div>
                      <div className="font-semibold">
                        1 credit ≈ 1 segment (~{Math.round(secondsPerCredit)}s)
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Credits are consumed when rendering videos (charged per completed segment)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">${starterTotal.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{starterCredits} segments (~{Math.round(starterCredits * secondsPerCredit)}s)</div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-[10px] border bg-card">
                      <div className="text-sm font-medium">Starter</div>
                      <div className="text-xs text-muted-foreground">{starterCredits} segments</div>
                      <div className="mt-1 font-semibold">${starterTotal.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-[10px] border bg-card">
                      <div className="text-sm font-medium">Popular</div>
                      <div className="text-xs text-muted-foreground">{tenPackCredits} segments</div>
                      <div className="mt-1 font-semibold">${tenPackTotal.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Equivalent: <span className="font-medium text-foreground">${PRICE_PER_CREDIT.toFixed(2)}</span> per segment credit.
                  </div>

                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>• Credits are used to render videos</p>
                    <p>• Credits do not expire</p>
                    <p>• Pay only for what you use</p>
                    <p>• Credits are charged per rendered segment</p>
                  </div>
                </div>

                {balance && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Current credit balance</p>
                        <p className="text-2xl font-bold">{balance.credits.toLocaleString()} credits</p>
                      </div>
                      <Button
                        onClick={handleBuyCredits}
                        className="rounded-[14px]"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Buy Credits
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleBuyCredits}
                  variant="outline"
                  className="w-full rounded-[14px]"
                  size="lg"
                >
                  Buy Credits
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* FAQ */}
          <div className="space-y-4 mt-12">
            <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <Card className="rounded-[14px]">
                <CardHeader>
                  <CardTitle className="text-lg">Do credits expire?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    No, purchased credits never expire. Use them whenever you need to render videos.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[14px]">
                <CardHeader>
                  <CardTitle className="text-lg">What happens if a render fails?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Failed renders are automatically refunded. You'll get your credits back for any video that doesn't complete successfully.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[14px]">
                <CardHeader>
                  <CardTitle className="text-lg">What is Studio Access?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Studio Access is a monthly subscription that unlocks the studio app features including the orchestration UI, provider integrations, team collaboration tools, and compliance tooling. It does not include any credits - credits are purchased separately on a pay-as-you-go basis.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
