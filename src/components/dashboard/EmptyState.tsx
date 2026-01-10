import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, Plus, Sparkles } from "lucide-react";

interface EmptyStateProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

const EmptyState = ({ hasFilters, onClearFilters }: EmptyStateProps) => {
  const navigate = useNavigate();

  if (hasFilters) {
    return (
      <div className="text-center py-16 px-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Video className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No matching videos</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Try adjusting your filters to see more results
        </p>
        <Button variant="outline" onClick={onClearFilters}>
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4 border rounded-xl bg-gradient-to-b from-muted/30 to-transparent">
      <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
        <Sparkles className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Create Your First Video</h3>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Transform your images into stunning AI-generated videos in minutes. 
        Just upload an image and describe your vision.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button size="lg" onClick={() => navigate("/video-generator")}>
          <Plus className="mr-2 h-5 w-5" />
          Create Your First Video
        </Button>
      </div>
      
      {/* Tips */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="font-semibold mb-1 text-sm">📸 Step 1</div>
          <p className="text-sm text-muted-foreground">Upload a high-quality image of your business or product</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="font-semibold mb-1 text-sm">✍️ Step 2</div>
          <p className="text-sm text-muted-foreground">Describe your marketing story and let AI generate scenes</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="font-semibold mb-1 text-sm">🎬 Step 3</div>
          <p className="text-sm text-muted-foreground">Review, edit prompts, and generate your video</p>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
