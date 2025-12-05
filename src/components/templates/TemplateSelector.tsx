import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles } from "lucide-react";
import { TemplateModal } from "./TemplateModal";

interface TemplateSelectorProps {
  onSelectTemplate: (template: any) => void;
}

export const TemplateSelector = ({ onSelectTemplate }: TemplateSelectorProps) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-card border rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Start with a Template</h3>
            <p className="text-sm text-muted-foreground">
              Save time by using a pre-built or custom template
            </p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Browse Templates
        </Button>
      </div>

      <TemplateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSelectTemplate={(template) => {
          onSelectTemplate(template);
          setShowModal(false);
        }}
      />
    </div>
  );
};
