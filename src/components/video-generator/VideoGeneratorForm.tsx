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

interface VideoGeneratorFormProps {
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

const VideoGeneratorForm = ({ userId }: VideoGeneratorFormProps) => {
  const { toast } = useToast();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    industry: "",
    avatarName: "",
    city: "",
    storyIdea: "",
    model: "veo3_fast", // Only model supported for image-to-video
    aspectRatio: "16:9",
    watermark: "",
    numberOfScenes: 3
  });
  const [scenePrompts, setScenePrompts] = useState<Array<{ 
    scene_number: number; 
    prompt: string;
    script?: string;
  }>>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
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

      // Call edge function to analyze image
      const { data, error } = await supabase.functions.invoke('analyze-image-kie', {
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

      if (!data?.success) {
        throw new Error(data?.error || 'AI analysis failed');
      }

      // Handle multi-scene response
      if (data.scenes && Array.isArray(data.scenes)) {
        setScenePrompts(data.scenes);
      } else {
        // Fallback for single prompt (backward compatibility)
        setScenePrompts([{ scene_number: 1, prompt: data.prompt }]);
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

      const isMultiScene = scenePrompts.length > 1;

      // Create generation record with multi-scene support
      const { data: generation, error: insertError } = await supabase
        .from('kie_video_generations')
        .insert({
          user_id: userId,
          image_url: photoData.file_url,
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          ai_prompt: scenePrompts[0].prompt, // First scene prompt as main
          model: formData.model,
          aspect_ratio: formData.aspectRatio,
          watermark: formData.watermark || null,
          number_of_scenes: scenePrompts.length,
          scene_prompts: scenePrompts,
          current_scene: 1,
          is_multi_scene: isMultiScene
        })
        .select()
        .single();

      if (insertError || !generation) {
        throw new Error('Failed to create generation record');
      }

      // Combine visual prompt with script for complete instructions
      const firstScenePrompt = scenePrompts[0].prompt;
      const firstSceneScript = scenePrompts[0].script || '';
      
      const enhancedPrompt = firstSceneScript 
        ? `${firstScenePrompt}\n\nAVATAR DIALOGUE: The person speaks these words: "${firstSceneScript}"`
        : firstScenePrompt;

      // Trigger video generation with first scene prompt
      const { data: generateData, error: generateError } = await supabase.functions.invoke('kie-generate-video', {
        body: {
          generation_id: generation.id,
          prompt: enhancedPrompt,
          image_url: photoData.file_url,
          model: formData.model,
          aspect_ratio: formData.aspectRatio,
          watermark: formData.watermark || ''
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
        description: isMultiScene 
          ? `Generating ${scenePrompts.length} scenes. Check the 'My Videos' tab for progress.`
          : "Your video is being generated. Check the 'My Videos' tab for progress.",
      });

      // Reset form
      setSelectedPhotoId(null);
      setFormData({
        industry: "",
        avatarName: "",
        city: "",
        storyIdea: "",
        model: "veo3_fast",
        aspectRatio: "16:9",
        watermark: "",
        numberOfScenes: 3
      });
      setScenePrompts([]);
      setCurrentSceneIndex(0);

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
            Upload an image and tell us about your business
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
              <p className="text-xs text-muted-foreground">
                Describe the marketing message or story you want to tell (e.g., problem → solution, before → after, customer journey)
              </p>
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
                  <SelectItem value="2">2 Scenes (16s total)</SelectItem>
                  <SelectItem value="3">3 Scenes (24s total)</SelectItem>
                  <SelectItem value="4">4 Scenes (32s total)</SelectItem>
                  <SelectItem value="5">5 Scenes (40s total)</SelectItem>
                  <SelectItem value="6">6 Scenes (48s total)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Each scene is 8 seconds, creating a complete story
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Video Model</Label>
              <Select
                value={formData.model}
                onValueChange={(value) => setFormData({ ...formData, model: value })}
              >
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veo3_fast">Veo Fast (Image-to-Video)</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
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
                Generate AI Prompt
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
              AI generated {scenePrompts.length} scene prompts for your story. Edit any scene before generating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenePrompts.map((scene, index) => (
              <div key={scene.scene_number} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">
                    Scene {scene.scene_number} of {scenePrompts.length}
                  </Label>
                  <span className="text-sm text-muted-foreground">8 seconds</span>
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
                Total video duration: {scenePrompts.length * 8} seconds ({scenePrompts.length} scenes × 8s each)
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

export default VideoGeneratorForm;
