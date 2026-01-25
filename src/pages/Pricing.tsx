import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  const { subscription } = useStudioAccess();
  const { balance } = useCredits();

  const handleSubscribe = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/pricing");
        return;
      }

      const response = await supabase.functions.invoke("create-checkout-session", {
        body: {
          mode: "subscription",
          planId: "studio_access",
        },
      });

      if (response.error) throw response.error;

      const { url } = response.data;
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Failed to start checkout. Please try again.");
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
                  disabled={subscription?.status === "active"}
                  className="w-full rounded-[14px]"
                  size="lg"
                >
                  {subscription?.status === "active" ? (
                    "Studio Access Active"
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
                      <div className="font-semibold">1 credit = {CREDITS_PER_MINUTE === 1 ? "1 rendered minute" : `${1/CREDITS_PER_MINUTE} rendered minutes`}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Credits are provider-agnostic
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">${PRICE_PER_CREDIT.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">per credit</div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>• Credits are used to render videos</p>
                    <p>• Credits do not expire</p>
                    <p>• Pay only for what you use</p>
                    <p>• Provider-agnostic (works with Kie and others)</p>
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
