import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SaveTemplateDialogProps {
  formData: any;
}

export const SaveTemplateDialog = ({ formData }: SaveTemplateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your template.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("request_templates").insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        is_system_template: false,
        title: formData.title,
        caption: formData.caption,
        story_idea: formData.storyIdea,
        company_type: formData.companyType,
        client_company_name: formData.clientCompanyName,
        city_community: formData.cityCommunity,
        character: formData.character,
        visual_style: formData.visualStyle,
        colors: formData.colors,
        gender_avatar: formData.genderAvatar,
        scenes: formData.scenes,
        aspect_ratio: formData.aspectRatio,
        render_mode: formData.renderMode,
        special_request: formData.specialRequest,
      });

      if (error) throw error;

      toast({
        title: "Template saved",
        description: "Your template has been created successfully.",
      });

      setOpen(false);
      setName("");
      setDescription("");
      setCategory("");
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <Save className="mr-2 h-4 w-4" />
          Save as Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save your current configuration as a template for future use.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Standard Roofing Ad"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Input
              id="template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., seasonal, service-type"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
