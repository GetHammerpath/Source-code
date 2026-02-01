import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { ArrowLeft, Loader2, Plus } from "lucide-react";

const Templates = () => {
  const navigate = useNavigate();
  const [systemTemplates, setSystemTemplates] = useState<any[]>([]);
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadTemplates();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data: systemData } = await supabase
        .from("request_templates")
        .select("*")
        .eq("is_system_template", true)
        .order("name");

      const { data: userData } = await supabase
        .from("request_templates")
        .select("*")
        .eq("is_system_template", false)
        .order("name");

      setSystemTemplates(systemData || []);
      setUserTemplates(userData || []);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: any) => {
    navigate("/new-request", { state: { template } });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Templates</h1>
              <p className="text-muted-foreground mt-2">
                Manage your request templates
              </p>
            </div>
            <Button onClick={() => navigate("/new-request")}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="system" className="w-full">
              <TabsList>
                <TabsTrigger value="system">
                  Pre-Built Templates ({systemTemplates.length})
                </TabsTrigger>
                <TabsTrigger value="custom">
                  My Templates ({userTemplates.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="system" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {systemTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={() => handleSelectTemplate(template)}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="mt-6">
                {userTemplates.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>No Custom Templates</CardTitle>
                      <CardDescription>
                        You haven't created any custom templates yet.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a new request and save it as a template to reuse your configurations.
                      </p>
                      <Button onClick={() => navigate("/new-request")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Request
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                        showActions
                        onDelete={loadTemplates}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default Templates;
