import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Lightbulb } from "lucide-react";

interface RetryEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failedSceneNumber: number;
  originalPrompt: string;
  originalScript: string;
  errorMessage: string;
  onRetry: (editedPrompt: string, editedScript: string) => Promise<void>;
  isRetrying: boolean;
}

const RetryEditModal = ({
  open,
  onOpenChange,
  failedSceneNumber,
  originalPrompt,
  originalScript,
  errorMessage,
  onRetry,
  isRetrying,
}: RetryEditModalProps) => {
  const [editedPrompt, setEditedPrompt] = useState(originalPrompt || "");
  const [editedScript, setEditedScript] = useState(originalScript || "");

  // Reset when modal opens with new values
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setEditedPrompt(originalPrompt || "");
      setEditedScript(originalScript || "");
    }
    onOpenChange(isOpen);
  };

  const handleRetry = async () => {
    await onRetry(editedPrompt, editedScript);
  };

  const isContentPolicy = errorMessage?.toLowerCase().includes("content policy") || 
                          errorMessage?.toLowerCase().includes("moderation") ||
                          errorMessage?.toLowerCase().includes("safety");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit & Retry Scene {failedSceneNumber}
            <Badge variant="destructive" className="ml-2">Failed</Badge>
          </DialogTitle>
          <DialogDescription>
            Edit the visual prompt and avatar script before retrying the generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Message */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Message</AlertTitle>
            <AlertDescription className="mt-1 text-sm">
              {errorMessage || "Unknown error occurred"}
            </AlertDescription>
          </Alert>

          {/* Tips for Common Issues */}
          <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">Tips for Fixing</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm mt-1">
              <ul className="list-disc list-inside space-y-1">
                {isContentPolicy ? (
                  <>
                    <li>Remove any references to violence, weapons, or explicit content</li>
                    <li>Avoid celebrity names or real public figures</li>
                    <li>Use professional, business-appropriate language</li>
                    <li>Keep descriptions focused on the work/service</li>
                  </>
                ) : (
                  <>
                    <li>Simplify complex camera movements</li>
                    <li>Reduce the number of actions in a single scene</li>
                    <li>Ensure the prompt is clear and specific</li>
                    <li>Check for any formatting issues in the text</li>
                  </>
                )}
              </ul>
            </AlertDescription>
          </Alert>

          {/* Visual Prompt */}
          <div className="space-y-2">
            <Label htmlFor="visual-prompt" className="text-sm font-semibold">
              Visual Prompt
            </Label>
            <Textarea
              id="visual-prompt"
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              placeholder="Enter the visual description for this scene..."
              className="min-h-[120px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Describe what should visually happen in this scene.
            </p>
          </div>

          {/* Avatar Script */}
          <div className="space-y-2">
            <Label htmlFor="avatar-script" className="text-sm font-semibold">
              Avatar Script
            </Label>
            <Textarea
              id="avatar-script"
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              placeholder="Enter what the avatar should say..."
              className="min-h-[100px] text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The dialogue or narration for the avatar in this scene.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRetrying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRetry}
            disabled={isRetrying || (!editedPrompt && !editedScript)}
          >
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              "Retry with Edits"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RetryEditModal;
