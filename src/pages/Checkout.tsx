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

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "access"; // access or credits
  const [loading, setLoading] = useState(false);
  const { subscription } = useStudioAccess();
  const { balance } = useCredits();

  // Credit purchase state
  const [creditAmount, setCreditAmount] = useState(500);
  const quickAmounts = [100, 250, 500, 1000];

  useEffect(() => {
    // Redirect to auth if not logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/checkout");
      }
    };
    checkAuth();
  }, [navigate]);

  const totalPrice = calculateCreditPrice(creditAmount);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      if (mode === "access") {
        // Studio Access subscription
        const response = await supabase.functions.invoke("create-checkout-session", {
          body: {
            mode: "subscription",
            planId: "studio_access",
          },
        });

        console.log("Checkout response:", response);

        if (response.error) {
          console.error("Response error:", response.error);
          throw response.error;
        }

        if (!response.data) {
          throw new Error("No data returned from checkout session");
        }

        const { url } = response.data;
        if (url) {
          window.location.href = url;
        } else {
          throw new Error("No checkout URL returned");
        }
      } else if (mode === "credits") {
        // Credit purchase
        const response = await supabase.functions.invoke("create-checkout-session", {
          body: {
            mode: "credits",
            credits: creditAmount,
          },
        });

        console.log("Checkout response:", response);

        if (response.error) {
          console.error("Response error:", response.error);
          throw response.error;
        }

        if (!response.data) {
          throw new Error("No data returned from checkout session");
        }

        const { url } = response.data;
        if (url) {
          window.location.href = url;
        } else {
          throw new Error("No checkout URL returned");
        }
      }
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      const errorMessage = error?.message || error?.error?.message || "Unknown error";
      console.error("Full error details:", error);
      alert(`Failed to start checkout: ${errorMessage}. Please check the console for details.`);
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
                      <span className="text-muted-foreground">Credits:</span>
                      <span className="font-medium">{creditAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price per credit:</span>
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
                      min={1}
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="rounded-[14px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Credits are used for rendering videos
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Quick Select</Label>
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((amount) => (
                        <Button
                          key={amount}
                          variant={creditAmount === amount ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCreditAmount(amount)}
                          className="rounded-[10px]"
                        >
                          {amount.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-[10px] text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Price per credit:</span>
                      <span className="font-medium">${PRICE_PER_CREDIT.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
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
                disabled={loading || (mode === "credits" && creditAmount < 1)}
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
