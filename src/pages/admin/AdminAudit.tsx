import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminAudit = () => {
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Audit Log"
          subtitle="View all admin actions and changes"
        />
        <Card className="rounded-[10px] border">
          <CardHeader>
            <CardTitle className="text-base">Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Audit log page - Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAudit;
