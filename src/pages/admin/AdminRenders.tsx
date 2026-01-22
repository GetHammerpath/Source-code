import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminRenders = () => {
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Renders"
          subtitle="Monitor video generation jobs and retries"
        />
        <Card className="rounded-[10px] border">
          <CardHeader>
            <CardTitle className="text-base">Render Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Render operations page - Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminRenders;
