import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import { useStudioAccess } from "@/hooks/useStudioAccess";
import { useCredits } from "@/hooks/useCredits";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { subscription, refresh: refreshSubscription } = useStudioAccess({ silent: true });
  const { balance, refresh: refreshCredits } = useCredits();

  useEffect(() => {
    // Refresh data when page loads
    refreshSubscription();
    refreshCredits();
  }, [refreshSubscription, refreshCredits]);

  return (
    <div className="h-full w-full bg-background flex items-center justify-center">
      <Card className="rounded-[14px] max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your payment has been processed and your account has been updated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sessionId && (
            <div className="text-center text-sm text-muted-foreground">
              <p>Session ID: {sessionId.slice(0, 20)}...</p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            {subscription && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Studio Access:</span>
                <span className="font-medium">{subscription.status === 'active' ? 'Active' : subscription.status}</span>
              </div>
            )}
            {balance && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Balance:</span>
                <span className="font-medium">{balance.credits.toLocaleString()} credits</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/dashboard")}
              variant="outline"
              className="flex-1 rounded-[14px]"
            >
              Go to Dashboard
            </Button>
            <Button
              onClick={() => navigate("/account/billing")}
              className="flex-1 rounded-[14px]"
            >
              View Billing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
