import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import SinglePhotoSelector from "./SinglePhotoSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuickRequestFormProps {
  onComplete: (generatedData: any, photoId: string | null) => void;
  onCancel: () => void;
}

const QuickRequestForm = ({ onComplete, onCancel }: QuickRequestFormProps) => {
  const { toast } = useToast();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [quickFormData, setQuickFormData] = useState({
    companyName: "",
    companyType: "",
    avatarName: "",
    cityCommunity: "",
    renderMode: "veo3_fast"
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    // Validation
    if (!selectedPhotoId) {
      toast({
        title: "Image Required",
        description: "Please upload or select an image first.",
        variant: "destructive"
      });
      return;
    }

    if (!quickFormData.companyName || !quickFormData.companyType || !quickFormData.avatarName || !quickFormData.cityCommunity) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Get image URL from selected photo
      const { data: photoData, error: photoError } = await supabase
        .from('jobsite_photos')
        .select('file_url')
        .eq('id', selectedPhotoId)
        .single();

      if (photoError || !photoData) {
        throw new Error('Failed to get image URL');
      }

      // Call edge function to analyze image
      const { data, error } = await supabase.functions.invoke('analyze-image-for-request', {
        body: {
          image_url: photoData.file_url,
          company_name: quickFormData.companyName,
          company_type: quickFormData.companyType,
          avatar_name: quickFormData.avatarName,
          city_community: quickFormData.cityCommunity,
          render_mode: quickFormData.renderMode
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to analyze image');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'AI analysis failed');
      }

      toast({
        title: "Success!",
        description: "AI generated your video brief. Review and edit as needed.",
      });

      onComplete(data.data, selectedPhotoId);

    } catch (error) {
      console.error('Error analyzing image:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Quick Request (AI-Powered)
        </CardTitle>
        <CardDescription>
          Upload an image and provide basic details. AI will generate the creative brief for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Image Upload */}
        <div className="space-y-2">
          <Label>Image *</Label>
          <SinglePhotoSelector
            selectedPhotoId={selectedPhotoId}
            onPhotoSelect={setSelectedPhotoId}
          />
        </div>

        {/* Essential Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Client Company Name *</Label>
            <Input
              id="companyName"
              value={quickFormData.companyName}
              onChange={(e) => setQuickFormData({ ...quickFormData, companyName: e.target.value })}
              placeholder="ABC Roofing"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyType">Company Type *</Label>
            <Select
              value={quickFormData.companyType}
              onValueChange={(value) => setQuickFormData({ ...quickFormData, companyType: value })}
            >
              <SelectTrigger id="companyType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roofing">Roofing</SelectItem>
                <SelectItem value="gutter">Gutter</SelectItem>
                <SelectItem value="christmas_lights">Christmas Lights</SelectItem>
                <SelectItem value="power_washing">Power Washing</SelectItem>
                <SelectItem value="landscaping">Landscaping</SelectItem>
                <SelectItem value="hvac">HVAC</SelectItem>
                <SelectItem value="plumbing">Plumbing</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="painting">Painting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarName">Avatar Name *</Label>
            <Input
              id="avatarName"
              value={quickFormData.avatarName}
              onChange={(e) => setQuickFormData({ ...quickFormData, avatarName: e.target.value })}
              placeholder="John Smith"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cityCommunity">City or Community *</Label>
            <Input
              id="cityCommunity"
              value={quickFormData.cityCommunity}
              onChange={(e) => setQuickFormData({ ...quickFormData, cityCommunity: e.target.value })}
              placeholder="Austin, TX"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="renderMode">Render Quality *</Label>
            <Select
              value={quickFormData.renderMode}
              onValueChange={(value) => setQuickFormData({ ...quickFormData, renderMode: value })}
            >
              <SelectTrigger id="renderMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="veo3_fast">Fast (Recommended)</SelectItem>
                <SelectItem value="veo3">High Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex-1"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze & Generate
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isAnalyzing}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickRequestForm;
