import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";

const CheckoutCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full bg-background flex items-center justify-center">
      <Card className="rounded-[14px] max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>
            Your payment was cancelled. No charges were made.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            You can try again anytime. If you have any questions, please contact support.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/pricing")}
              variant="outline"
              className="flex-1 rounded-[14px]"
            >
              Back to Pricing
            </Button>
            <Button
              onClick={() => navigate("/dashboard")}
              className="flex-1 rounded-[14px]"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutCancel;
