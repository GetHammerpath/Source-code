import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wand2, Sparkles, Info, Eye, ArrowRight, User, MapPin, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";

interface SoraShot {
  Scene?: string;
  prompt?: string;
  visual_prompt?: string;
  script?: string;
  duration: number;
  scene_number?: number;
  scene_purpose?: string;
  connects_to_next?: string;
}

interface ImageAnalysis {
  avatar_appearance?: string;
  clothing_details?: string;
  accessories?: string;
  environment?: string;
  lighting_mood?: string;
  brand_elements?: string;
}

// Helper to get scene prompt (supports old and new formats)
const getScenePrompt = (scene: SoraShot): string => {
  return scene.prompt || scene.Scene || '';
};

// Helper to get visual prompt
const getVisualPrompt = (scene: SoraShot): string => {
  return scene.visual_prompt || '';
};

// Helper to get script
const getScript = (scene: SoraShot): string => {
  return scene.script || '';
};

interface SoraFormData {
  industry: string;
  avatarName: string;
  city: string;
  storyIdea: string;
  numberOfScenes: number;
  duration: number;
  aspectRatio: '16:9' | '9:16';
  audioEnabled: boolean;
  watermark: boolean;
}

interface SoraStoryboardFormProps {
  userId: string;
}

const SoraStoryboardForm = ({ userId }: SoraStoryboardFormProps) => {
  const { toast } = useToast();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenePrompts, setScenePrompts] = useState<SoraShot[]>([]);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [overallTheme, setOverallTheme] = useState<string>("");
  
  const [formData, setFormData] = useState<SoraFormData>({
    industry: "",
    avatarName: "",
    city: "",
    storyIdea: "",
    numberOfScenes: 2,
    duration: 10,
    aspectRatio: "16:9",
    audioEnabled: true,
    watermark: false
  });

  const handlePhotoSelect = async (photoId: string) => {
    setSelectedPhotoId(photoId);
    
    const { data, error } = await supabase
      .from('jobsite_photos')
      .select('file_url')
      .eq('id', photoId)
      .single();
    
    if (error) {
      console.error('Error fetching photo:', error);
      toast({
        title: "Error",
        description: "Failed to load photo URL",
        variant: "destructive",
      });
      return;
    }
    
    setPhotoUrl(data.file_url);
  };

  const handleAnalyze = async () => {
    if (!photoUrl || !formData.industry || !formData.avatarName || !formData.city) {
      toast({
        title: "Missing Information",
        description: "Please complete all required fields and select a photo",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setImageAnalysis(null);
    setOverallTheme("");

    try {
      const { data, error } = await supabase.functions.invoke('analyze-image-sora', {
        body: {
          image_url: photoUrl,
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          number_of_scenes: formData.numberOfScenes,
          duration_per_scene: formData.duration
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate prompts');
      }

      setScenePrompts(data.shots);
      setImageAnalysis(data.image_analysis || null);
      setOverallTheme(data.overall_theme || "");
      
      toast({
        title: "Prompts Generated!",
        description: `${data.shots.length} scene prompt(s) created with image analysis. Review and edit before generating.`,
      });

    } catch (error: any) {
      console.error('Error analyzing image:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate scene prompts",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (scenePrompts.length === 0) {
      toast({
        title: "No Prompts",
        description: "Please generate scene prompts first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create generation record
      const { data: generation, error: insertError } = await supabase
        .from('kie_video_generations')
        .insert({
          user_id: userId,
          image_url: photoUrl,
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          model: 'sora-2-pro-storyboard',
          aspect_ratio: formData.aspectRatio,
          watermark: formData.watermark ? 'enabled' : null,
          number_of_scenes: formData.numberOfScenes,
          scene_prompts: scenePrompts.map((scene, index) => ({
            ...scene,
            scene_number: index + 1
          })) as any,
          is_multi_scene: formData.numberOfScenes > 1,
          current_scene: 1,
          duration: formData.duration,
          audio_enabled: formData.audioEnabled,
          resolution: '1080p',
          sora_model: 'sora-2-pro-storyboard'
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Call sora-generate-video edge function
      const { data: generateData, error: generateError } = await supabase.functions.invoke('sora-generate-video', {
        body: {
          generation_id: generation.id,
          prompt: getScenePrompt(scenePrompts[0]),
          image_url: photoUrl,
          model: 'sora-2-pro-storyboard',
          aspect_ratio: formData.aspectRatio,
          duration: formData.duration,
          watermark: formData.watermark,
          audio_enabled: formData.audioEnabled,
          shots: scenePrompts
        }
      });

      if (generateError) throw generateError;

      if (!generateData.success) {
        throw new Error(generateData.error || 'Video generation failed');
      }

      toast({
        title: "Video Generation Started!",
        description: `Your Sora 2 Pro video is being generated. This may take 2-3 minutes per scene.`,
      });

      // Reset form
      setScenePrompts([]);
      setImageAnalysis(null);
      setOverallTheme("");
      setSelectedPhotoId(null);
      setPhotoUrl("");
      setFormData({
        industry: "",
        avatarName: "",
        city: "",
        storyIdea: "",
        numberOfScenes: 2,
        duration: 10,
        aspectRatio: "16:9",
        audioEnabled: true,
        watermark: false
      });

    } catch (error: any) {
      console.error('Error generating video:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateScenePrompt = (index: number, newPrompt: string) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], Scene: newPrompt, prompt: newPrompt };
    setScenePrompts(updated);
  };

  const updateVisualPrompt = (index: number, newVisualPrompt: string) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], visual_prompt: newVisualPrompt };
    setScenePrompts(updated);
  };

  const updateScript = (index: number, newScript: string) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], script: newScript };
    setScenePrompts(updated);
  };

  const updateSceneDuration = (index: number, newDuration: number) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], duration: newDuration };
    setScenePrompts(updated);
  };

  const updateScenePurpose = (index: number, newPurpose: string) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], scene_purpose: newPurpose };
    setScenePrompts(updated);
  };

  const updateConnectsToNext = (index: number, newConnection: string) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], connects_to_next: newConnection };
    setScenePrompts(updated);
  };

  const totalDuration = scenePrompts.reduce((sum, shot) => sum + shot.duration, 0);

  return (
    <div className="space-y-6">
      {/* Step 1: Upload Image */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Upload Avatar Image</CardTitle>
        </CardHeader>
        <CardContent>
          <SinglePhotoSelector
            selectedPhotoId={selectedPhotoId}
            onPhotoSelect={handlePhotoSelect}
          />
        </CardContent>
      </Card>

      {/* Step 2: Business Information */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="industry">Industry *</Label>
            <Input
              id="industry"
              placeholder="e.g., Plumbing, Roofing, Landscaping"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="avatarName">Avatar Name *</Label>
            <Input
              id="avatarName"
              placeholder="e.g., John Smith"
              value={formData.avatarName}
              onChange={(e) => setFormData({ ...formData, avatarName: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              placeholder="e.g., Austin, TX"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="storyIdea">Story Idea (Optional)</Label>
            <Textarea
              id="storyIdea"
              placeholder="Describe your video concept (2-3 sentences)"
              value={formData.storyIdea}
              onChange={(e) => setFormData({ ...formData, storyIdea: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Sora Settings */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            Step 3: Sora 2 Pro Storyboard Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number of Scenes (up to 10)</Label>
            <Select 
              value={formData.numberOfScenes.toString()} 
              onValueChange={(value) => setFormData({ ...formData, numberOfScenes: parseInt(value) })}
            >
              <SelectTrigger>
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

          <div>
            <Label>Duration per Scene</Label>
            <RadioGroup 
              value={formData.duration.toString()} 
              onValueChange={(value) => setFormData({ ...formData, duration: parseInt(value) })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="10" id="duration-10" />
                <Label htmlFor="duration-10">10 seconds</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="15" id="duration-15" />
                <Label htmlFor="duration-15">15 seconds</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Aspect Ratio</Label>
            <Select 
              value={formData.aspectRatio} 
              onValueChange={(value: '16:9' | '9:16') => setFormData({ ...formData, aspectRatio: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="audio-enabled"
                checked={formData.audioEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, audioEnabled: checked })}
              />
              <Label htmlFor="audio-enabled">Enable Synchronized Audio</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Sora 2 Pro generates natural dialogue and ambient sounds</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="watermark"
              checked={formData.watermark}
              onCheckedChange={(checked) => setFormData({ ...formData, watermark: checked })}
            />
            <Label htmlFor="watermark">Add Watermark</Label>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Generate Prompts */}
      <Button 
        onClick={handleAnalyze} 
        disabled={isAnalyzing || !photoUrl}
        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
        size="lg"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analyzing Image & Generating Prompts...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-5 w-5" />
            Generate Sora Storyboard Prompts
          </>
        )}
      </Button>

      {/* Image Analysis Results */}
      {imageAnalysis && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Eye className="h-5 w-5" />
              Image Analysis Results
            </CardTitle>
            <p className="text-sm text-blue-600">
              AI extracted these details from your uploaded image for consistent video generation
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {imageAnalysis.avatar_appearance && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <User className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Avatar Appearance</Label>
                    <p className="text-sm">{imageAnalysis.avatar_appearance}</p>
                  </div>
                </div>
              )}
              {imageAnalysis.clothing_details && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <Palette className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Clothing Details</Label>
                    <p className="text-sm">{imageAnalysis.clothing_details}</p>
                  </div>
                </div>
              )}
              {imageAnalysis.accessories && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Accessories</Label>
                    <p className="text-sm">{imageAnalysis.accessories}</p>
                  </div>
                </div>
              )}
              {imageAnalysis.environment && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Environment</Label>
                    <p className="text-sm">{imageAnalysis.environment}</p>
                  </div>
                </div>
              )}
              {imageAnalysis.lighting_mood && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Lighting & Mood</Label>
                    <p className="text-sm">{imageAnalysis.lighting_mood}</p>
                  </div>
                </div>
              )}
              {imageAnalysis.brand_elements && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <Eye className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Brand Elements</Label>
                    <p className="text-sm">{imageAnalysis.brand_elements}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Theme */}
      {overallTheme && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Sparkles className="h-5 w-5" />
              Overall Video Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={overallTheme}
              onChange={(e) => setOverallTheme(e.target.value)}
              rows={2}
              className="bg-white"
              placeholder="The central message of your video..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Edit this theme to adjust the overall direction of your video
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review Scene Prompts */}
      {scenePrompts.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle>Step 4: Review & Edit Scene Prompts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total Duration: {totalDuration} seconds | {scenePrompts.length} scene(s)
              {totalDuration !== 10 && totalDuration !== 15 && totalDuration !== 25 && (
                <span className="ml-2 text-amber-600 font-medium">
                  (will be adjusted to {[10, 15, 25].find(d => d >= totalDuration) || 25}s to match API requirements)
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {scenePrompts.map((scene, index) => {
              const hasNewFormat = scene.visual_prompt || scene.script;
              
              return (
                <div key={index} className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Label className="text-base font-semibold">Scene {index + 1}</Label>
                      {scene.scene_purpose && (
                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          {scene.scene_purpose}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Duration:</Label>
                      <Select
                        value={scene.duration.toString()}
                        onValueChange={(value) => updateSceneDuration(index, parseInt(value))}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10s</SelectItem>
                          <SelectItem value="15">15s</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Scene Purpose Editor */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Scene Purpose</Label>
                    <Input
                      value={scene.scene_purpose || ""}
                      onChange={(e) => updateScenePurpose(index, e.target.value)}
                      placeholder="e.g., Hook - Establish problem"
                      className="text-sm mt-1"
                    />
                  </div>

                  {hasNewFormat ? (
                    <>
                      <div>
                        <Label className="flex items-center gap-2">
                          📹 Visual Prompt
                          <span className="text-xs text-muted-foreground font-normal">
                            (Camera, scene, lighting, actions)
                          </span>
                        </Label>
                        <Textarea
                          value={getVisualPrompt(scene)}
                          onChange={(e) => updateVisualPrompt(index, e.target.value)}
                          rows={4}
                          className="font-mono text-sm mt-1"
                          placeholder="Describe camera movement, scene composition, lighting, and avatar actions..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {getVisualPrompt(scene).length} characters
                        </p>
                      </div>

                      <div>
                        <Label className="flex items-center gap-2">
                          🎤 Script / Dialogue
                          <span className="text-xs text-muted-foreground font-normal">
                            (What {formData.avatarName || 'avatar'} says)
                          </span>
                        </Label>
                        <Textarea
                          value={getScript(scene)}
                          onChange={(e) => updateScript(index, e.target.value)}
                          rows={3}
                          className="font-mono text-sm mt-1"
                          placeholder="What the avatar says out loud in this scene..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {getScript(scene).length} characters
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label>Scene Prompt (Legacy Format)</Label>
                      <Textarea
                        value={getScenePrompt(scene)}
                        onChange={(e) => updateScenePrompt(index, e.target.value)}
                        rows={6}
                        className="font-mono text-sm"
                      />
                    </div>
                  )}

                  {/* Scene Transition */}
                  {index < scenePrompts.length - 1 && (
                    <div className="pt-2 border-t border-dashed">
                      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        Transition to Scene {index + 2}
                      </Label>
                      <Input
                        value={scene.connects_to_next || ""}
                        onChange={(e) => updateConnectsToNext(index, e.target.value)}
                        placeholder="How this scene leads into the next..."
                        className="text-sm mt-1"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Generate Video */}
      {scenePrompts.length > 0 && (
        <Button 
          onClick={handleGenerateVideo} 
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Starting Generation...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Sora 2 Pro Video
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default SoraStoryboardForm;
