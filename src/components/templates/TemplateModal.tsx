import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { TemplateCard } from "./TemplateCard";
import { Loader2 } from "lucide-react";

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: any) => void;
}

export const TemplateModal = ({ open, onClose, onSelectTemplate }: TemplateModalProps) => {
  const [systemTemplates, setSystemTemplates] = useState<any[]>([]);
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Load system templates
      const { data: systemData } = await supabase
        .from("request_templates")
        .select("*")
        .eq("is_system_template", true)
        .order("name");

      // Load user templates
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="system" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="system">
                Pre-Built Templates ({systemTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="custom">
                My Templates ({userTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="system" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={() => onSelectTemplate(template)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom" className="mt-4">
              {userTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No custom templates yet.</p>
                  <p className="text-sm mt-2">
                    Create a request and save it as a template for future use.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={() => onSelectTemplate(template)}
                      showActions
                      onDelete={loadTemplates}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
