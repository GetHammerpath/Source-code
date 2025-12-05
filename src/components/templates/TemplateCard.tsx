import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TemplateCardProps {
  template: any;
  onSelect: () => void;
  showActions?: boolean;
  onDelete?: () => void;
}

export const TemplateCard = ({ template, onSelect, showActions, onDelete }: TemplateCardProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("request_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: "Your template has been removed.",
      });

      onDelete?.();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="hover:border-primary transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {template.name}
            </CardTitle>
            <CardDescription className="mt-1">{template.description}</CardDescription>
          </div>
          {template.category && (
            <Badge variant="secondary" className="ml-2">
              {template.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {template.title && (
            <div className="text-sm">
              <span className="font-medium">Title:</span> {template.title}
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {template.company_type && (
              <Badge variant="outline">{template.company_type}</Badge>
            )}
            {template.aspect_ratio && (
              <Badge variant="outline">{template.aspect_ratio}</Badge>
            )}
            {template.scenes && (
              <Badge variant="outline">{template.scenes} scenes</Badge>
            )}
            {template.visual_style && (
              <Badge variant="outline">{template.visual_style}</Badge>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onSelect} className="flex-1">
              Use Template
            </Button>
            {showActions && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{template.name}"? This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
