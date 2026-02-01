import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, CreditCard } from "lucide-react";
import { STUDIO_ACCESS, PRICE_PER_CREDIT, calculateCreditPrice } from "@/lib/billing/pricing";
import { supabase } from "@/integrations/supabase/client";
import { useStudioAccess } from "@/hooks/useStudioAccess";
import { useCredits } from "@/hooks/useCredits";
import StudioHeader from "@/components/layout/StudioHeader";

type EnvStatus = { stripe: boolean; serviceRole: boolean; priceId: boolean; siteUrl: boolean } | null;

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "access"; // access or credits
  const [loading, setLoading] = useState(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus>(null);
  const { subscription } = useStudioAccess();
  const { balance } = useCredits();

  // Credit purchase state (minimum 30 credits)
  const [creditAmount, setCreditAmount] = useState(100);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/checkout");
        return;
      }
      const url = import.meta.env.VITE_SUPABASE_URL;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url) return;
      try {
        const res = await fetch(`${url}/functions/v1/create-checkout-session`, {
          method: "GET",
          headers: anon ? { apikey: anon } : {},
        });
        const j = await res.json().catch(() => ({}));
        if (j?.env) setEnvStatus(j.env as EnvStatus);
      } catch {
        /**/
      }
    };
    checkAuth();
  }, [navigate]);

  const totalPrice = calculateCreditPrice(creditAmount);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to checkout");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Missing Supabase config (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)");
      }

      const body =
        mode === "access"
          ? { mode: "subscription", planId: "studio_access" }
          : mode === "credits"
            ? { mode: "credits", credits: creditAmount, totalCents: Math.round(totalPrice * 100) }
            : null;
      if (!body) throw new Error("Invalid checkout mode");

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      let data: { url?: string; sessionId?: string; error?: string; details?: unknown } = {};
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
        let details = "";
        if (data?.details != null) {
          const raw = typeof data.details === "string" ? data.details : JSON.stringify(data.details);
          details = raw.length > 600 ? `\n\nDetails: ${raw.slice(0, 600)}…` : `\n\nDetails: ${raw}`;
        }
        throw new Error(`${msg}${details}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }
      if (!data?.url) {
        throw new Error("No checkout URL returned. Check STUDIO_ACCESS_PRICE_ID and Edge Function logs.");
      }

      window.location.href = data.url;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Checkout error:", error);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wzpswnuteisyxxwlnqrn.supabase.co";
      const verifyUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;
      const logsUrl = "https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions/create-checkout-session/logs";
      const genericHint =
        /non-2xx|status code/i.test(msg)
          ? "\n\nThe actual error is in the Edge Function logs. Common causes: missing STRIPE_SECRET_KEY, SERVICE_ROLE_KEY, or STUDIO_ACCESS_PRICE_ID in Supabase Edge Function secrets."
          : "";
      alert(
        `Failed to start checkout: ${msg}${genericHint}\n\nLogs: ${logsUrl}\n\nVerify secrets: ${verifyUrl}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-background">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-8">
        <StudioHeader
          title="Complete Your Purchase"
          subtitle="Review your order and proceed to secure payment"
        />

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card className="rounded-[14px]">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {mode === "access" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{STUDIO_ACCESS.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ${STUDIO_ACCESS.price}/month subscription
                    </p>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        {STUDIO_ACCESS.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Includes 0 credits. Credits are purchased separately.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {mode === "credits" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">Credit Purchase</h3>
                    <p className="text-sm text-muted-foreground">One-time purchase</p>
                  </div>
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Segments (credits):</span>
                      <span className="font-medium">{creditAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price per segment credit:</span>
                      <span className="font-medium">${PRICE_PER_CREDIT.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-semibold pt-2 border-t">
                      <span>Total:</span>
                      <span>${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {balance && mode === "credits" && (
                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Current balance: <span className="font-medium text-foreground">{balance.credits.toLocaleString()} credits</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    After purchase: {(balance.credits + creditAmount).toLocaleString()} credits
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Action */}
          <Card className="rounded-[14px]">
            <CardHeader>
              <CardTitle>Secure Payment</CardTitle>
              <CardDescription>
                {mode === "access" 
                  ? "You'll be redirected to Stripe to complete your subscription"
                  : "You'll be redirected to Stripe to complete your credit purchase"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {mode === "credits" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Purchase Credits</Label>
                    <Input
                      type="number"
                      min={30}
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(Math.max(30, parseInt(e.target.value) || 30))}
                      className="rounded-[14px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Credits are used for rendering videos. Minimum 30 credits.
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-[10px] text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Price per segment credit:</span>
                      <span className="font-medium">${PRICE_PER_CREDIT.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {envStatus && (mode === "access" ? !envStatus.stripe || !envStatus.serviceRole || !envStatus.priceId : !envStatus.stripe || !envStatus.serviceRole) && (
                <div className="p-4 rounded-[10px] bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                  <strong>Checkout not fully configured.</strong>{" "}
                  {mode === "access" && !envStatus.priceId
                    ? "Add STUDIO_ACCESS_PRICE_ID"
                    : "Add STRIPE_SECRET_KEY, SERVICE_ROLE_KEY"}
                  {" "}to Supabase Edge Function secrets.{" "}
                  <a href="https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions" target="_blank" rel="noreferrer" className="underline">
                    Open secrets
                  </a>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-[10px]">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium">Secure checkout by Stripe</div>
                  <div className="text-muted-foreground text-xs">Your payment information is encrypted and secure</div>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={loading || (mode === "credits" && creditAmount < 30)}
                className="w-full rounded-[14px] h-12 text-base"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue to Payment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <div className="text-xs text-center text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
