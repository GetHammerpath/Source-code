import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Video, Wand2 } from "lucide-react";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface Sora2LatestFormProps {
  userId: string;
}

const getErrorTitle = (errorType?: string) => {
  switch (errorType) {
    case 'CREDIT_EXHAUSTED':
      return '⚠️ Credits Exhausted';
    case 'RATE_LIMITED':
      return '⏱️ Rate Limited';
    case 'AUTH_ERROR':
      return '🔑 Authentication Error';
    case 'INVALID_PARAMS':
      return '⚙️ Invalid Parameters';
    default:
      return 'Generation Failed';
  }
};

const Sora2LatestForm = ({ userId }: Sora2LatestFormProps) => {
  const { toast } = useToast();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    industry: "",
    avatarName: "",
    city: "",
    storyIdea: "",
    aspectRatio: "16:9",
    watermark: "",
    numberOfScenes: 3,
    durationPerScene: 10 // 10, 15, or 25 seconds
  });
  const [scenePrompts, setScenePrompts] = useState<Array<{ 
    scene_number: number; 
    prompt: string;
    script?: string;
  }>>([]);
  const [imageAnalysis, setImageAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAnalyze = async () => {
    if (!selectedPhotoId) {
      toast({
        title: "Image Required",
        description: "Please upload or select an image first.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.industry || !formData.avatarName || !formData.city || !formData.storyIdea) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields including story idea.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Get image URL
      const { data: photoData, error: photoError } = await supabase
        .from('jobsite_photos')
        .select('file_url')
        .eq('id', selectedPhotoId)
        .single();

      if (photoError || !photoData) {
        throw new Error('Failed to get image URL');
      }

      // Call edge function to analyze image (reuse analyze-image-sora)
      const { data, error } = await supabase.functions.invoke('analyze-image-sora', {
        body: {
          image_url: photoData.file_url,
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          number_of_scenes: formData.numberOfScenes
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to analyze image');
      }

      if (!data?.success && !data?.shots) {
        throw new Error(data?.error || 'AI analysis failed');
      }

      // Handle multi-scene response from analyze-image-sora
      if (data.shots && Array.isArray(data.shots)) {
        setScenePrompts(data.shots.map((shot: any, index: number) => ({
          scene_number: index + 1,
          prompt: shot.visual_prompt || shot.prompt || '',
          script: shot.script || ''
        })));
        // Store image analysis for passing to generation
        if (data.image_analysis) {
          setImageAnalysis(data.image_analysis);
        }
      } else {
        throw new Error('No scene prompts generated');
      }

      toast({
        title: "Prompts Generated!",
        description: `AI has created ${formData.numberOfScenes} scene prompts. Review and edit if needed.`,
      });

    } catch (error) {
      console.error('Error analyzing image:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze image.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!scenePrompts.length) {
      toast({
        title: "No Prompts",
        description: "Please generate prompts first by analyzing an image.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Get image URL
      const { data: photoData, error: photoError } = await supabase
        .from('jobsite_photos')
        .select('file_url')
        .eq('id', selectedPhotoId)
        .single();

      if (photoError || !photoData) {
        throw new Error('Failed to get image URL');
      }

      // Trigger video generation with sora2-generate-video
      const { data: generateData, error: generateError } = await supabase.functions.invoke('sora2-generate-video', {
        body: {
          user_id: userId,
          image_url: photoData.file_url,
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          scene_prompts: scenePrompts,
          aspect_ratio: formData.aspectRatio,
          watermark: formData.watermark || '',
          duration: formData.durationPerScene,
          image_analysis: imageAnalysis // Pass image analysis for avatar consistency
        }
      });

      if (generateError || !generateData?.success) {
        const errorType = generateData?.error_type;
        const errorMessage = generateData?.error || 'Failed to start video generation';
        const userAction = generateData?.user_action;
        
        toast({
          title: getErrorTitle(errorType),
          description: (
            <div className="space-y-2">
              <p>{errorMessage}</p>
              {userAction && <p className="text-xs font-semibold mt-2">💡 {userAction}</p>}
            </div>
          ),
          variant: "destructive",
          duration: 8000
        });
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Video Generation Started!",
        description: `Generating ${scenePrompts.length} scenes. Check the 'My Videos' tab for progress.`,
      });

      // Reset form
      setSelectedPhotoId(null);
      setFormData({
        industry: "",
        avatarName: "",
        city: "",
        storyIdea: "",
        aspectRatio: "16:9",
        watermark: "",
        numberOfScenes: 3,
        durationPerScene: 10
      });
      setScenePrompts([]);
      setImageAnalysis(null);

    } catch (error) {
      console.error('Error generating video:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to start video generation.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const totalDuration = scenePrompts.length * formData.durationPerScene;

  return (
    <div className="grid gap-6 max-w-4xl">
      {/* Step 1: Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Step 1: Provide Details
          </CardTitle>
          <CardDescription>
            Upload an image and describe your video story
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Business Image *</Label>
            <SinglePhotoSelector
              selectedPhotoId={selectedPhotoId}
              onPhotoSelect={setSelectedPhotoId}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="e.g., Roofing, HVAC, Landscaping"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarName">Avatar/Spokesperson Name *</Label>
              <Input
                id="avatarName"
                value={formData.avatarName}
                onChange={(e) => setFormData({ ...formData, avatarName: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Austin, TX"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="storyIdea">Marketing Story Idea *</Label>
              <Textarea
                id="storyIdea"
                value={formData.storyIdea}
                onChange={(e) => setFormData({ ...formData, storyIdea: e.target.value })}
                placeholder="e.g., Show how our roofing service transforms old homes, highlighting quality, speed, and customer satisfaction"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfScenes">Number of Scenes</Label>
              <Select
                value={formData.numberOfScenes.toString()}
                onValueChange={(value) => setFormData({ ...formData, numberOfScenes: parseInt(value) })}
              >
                <SelectTrigger id="numberOfScenes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Scene</SelectItem>
                  <SelectItem value="2">2 Scenes</SelectItem>
                  <SelectItem value="3">3 Scenes</SelectItem>
                  <SelectItem value="4">4 Scenes</SelectItem>
                  <SelectItem value="5">5 Scenes</SelectItem>
                  <SelectItem value="6">6 Scenes</SelectItem>
                  <SelectItem value="7">7 Scenes</SelectItem>
                  <SelectItem value="8">8 Scenes</SelectItem>
                  <SelectItem value="9">9 Scenes</SelectItem>
                  <SelectItem value="10">10 Scenes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationPerScene">Duration per Scene</Label>
              <Select
                value={formData.durationPerScene.toString()}
                onValueChange={(value) => setFormData({ ...formData, durationPerScene: parseInt(value) })}
              >
                <SelectTrigger id="durationPerScene">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="25">25 seconds</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Total: {formData.numberOfScenes * formData.durationPerScene}s ({formData.numberOfScenes} scenes × {formData.durationPerScene}s)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspectRatio">Aspect Ratio</Label>
              <Select
                value={formData.aspectRatio}
                onValueChange={(value) => setFormData({ ...formData, aspectRatio: value })}
              >
                <SelectTrigger id="aspectRatio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="watermark">Watermark (Optional)</Label>
              <Input
                id="watermark"
                value={formData.watermark}
                onChange={(e) => setFormData({ ...formData, watermark: e.target.value })}
                placeholder="Your Brand"
              />
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Scene Prompts
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Review Scene Prompts */}
      {scenePrompts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Review & Edit Scene Prompts</CardTitle>
            <CardDescription>
              AI generated {scenePrompts.length} scene prompts. Edit any scene before generating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenePrompts.map((scene, index) => (
              <div key={scene.scene_number} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">
                    Scene {scene.scene_number} of {scenePrompts.length}
                  </Label>
                  <span className="text-sm text-muted-foreground">{formData.durationPerScene} seconds</span>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`scene-${scene.scene_number}-prompt`} className="text-sm font-medium">
                    Visual Prompt
                  </Label>
                  <Textarea
                    id={`scene-${scene.scene_number}-prompt`}
                    value={scene.prompt}
                    onChange={(e) => {
                      const updated = [...scenePrompts];
                      updated[index] = { ...scene, prompt: e.target.value };
                      setScenePrompts(updated);
                    }}
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`scene-${scene.scene_number}-script`} className="text-sm font-medium">
                    Avatar Script (Dialogue)
                  </Label>
                  <p className="text-xs text-muted-foreground">What the avatar says in this scene</p>
                  <Textarea
                    id={`scene-${scene.scene_number}-script`}
                    value={scene.script || ''}
                    onChange={(e) => {
                      const updated = [...scenePrompts];
                      updated[index] = { ...scene, script: e.target.value };
                      setScenePrompts(updated);
                    }}
                    rows={2}
                    className="italic"
                    placeholder="Enter dialogue for this scene..."
                  />
                </div>
              </div>
            ))}

            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-4">
                Total video duration: {totalDuration} seconds ({scenePrompts.length} scenes × {formData.durationPerScene}s each)
              </p>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Generation...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Generate {scenePrompts.length}-Scene Video
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Sora2LatestForm;
