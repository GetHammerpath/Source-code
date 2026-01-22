import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminBilling = () => {
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Billing"
          subtitle="Monitor Stripe webhooks and billing health"
        />
        <Card className="rounded-[10px] border">
          <CardHeader>
            <CardTitle className="text-base">Billing & Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Billing management page - Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBilling;
