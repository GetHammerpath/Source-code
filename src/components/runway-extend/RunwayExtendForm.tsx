import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Sparkles, Film, Wand2, Check, Edit2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScenePrompt {
  scene_number: number;
  prompt: string;
  script: string;
  camera: string;
  duration: number;
}

interface RunwayExtendFormProps {
  onGenerationStarted: () => void;
}

export function RunwayExtendForm({ onGenerationStarted }: RunwayExtendFormProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [numberOfScenes, setNumberOfScenes] = useState("3");
  const [durationPerScene, setDurationPerScene] = useState("10");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenePrompts, setScenePrompts] = useState<ScenePrompt[]>([]);
  const [avatarIdentityPrefix, setAvatarIdentityPrefix] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<any>(null);
  const [editingScene, setEditingScene] = useState<number | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase storage
    const fileName = `runway-extend/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('jobsite-photos')
      .upload(fileName, file);

    if (error) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    const { data: urlData } = supabase.storage
      .from('jobsite-photos')
      .getPublicUrl(fileName);

    setImageUrl(urlData.publicUrl);
    toast({
      title: "Image uploaded",
      description: "Ready to analyze for scene generation"
    });
  };

  const handleAnalyze = async () => {
    if (!imageUrl || !avatarName || !industry || !city) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and upload an image",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('runway-extend-analyze', {
        body: {
          image_url: imageUrl,
          avatar_name: avatarName,
          industry,
          city,
          story_idea: storyIdea,
          number_of_scenes: parseInt(numberOfScenes),
          duration_per_scene: parseInt(durationPerScene)
        }
      });

      if (error) throw error;

      if (data.success) {
        setScenePrompts(data.scenes || []);
        setAvatarIdentityPrefix(data.avatar_identity_prefix || "");
        setImageAnalysis(data.image_analysis || null);
        toast({
          title: "Analysis complete",
          description: `Generated ${data.scenes?.length || 0} scene prompts. Review and edit before generating.`
        });
      } else {
        throw new Error(data.error || "Analysis failed");
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in to generate videos",
        variant: "destructive"
      });
      return;
    }

    if (scenePrompts.length === 0) {
      toast({
        title: "No scenes",
        description: "Please analyze the image first to generate scene prompts",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('runway-extend-generate', {
        body: {
          user_id: user.id,
          image_url: imageUrl,
          avatar_name: avatarName,
          industry,
          city,
          story_idea: storyIdea,
          scene_prompts: scenePrompts,
          avatar_identity_prefix: avatarIdentityPrefix,
          image_analysis: imageAnalysis,
          number_of_scenes: parseInt(numberOfScenes),
          duration_per_scene: parseInt(durationPerScene),
          aspect_ratio: aspectRatio,
          resolution
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Generation started",
          description: "Your video is being generated. This may take several minutes."
        });
        onGenerationStarted();
        // Reset form
        setScenePrompts([]);
        setAvatarIdentityPrefix("");
        setImageAnalysis(null);
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateScenePrompt = (index: number, field: keyof ScenePrompt, value: string) => {
    const updated = [...scenePrompts];
    updated[index] = { ...updated[index], [field]: value };
    setScenePrompts(updated);
  };

  const totalDuration = parseInt(numberOfScenes) * parseInt(durationPerScene);

  return (
    <div className="space-y-6">
      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Frame Continuity</h3>
                <p className="text-sm text-muted-foreground">Each scene continues from the last frame</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Avatar Lock</h3>
                <p className="text-sm text-muted-foreground">Same person across all scenes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Up to 10 Scenes</h3>
                <p className="text-sm text-muted-foreground">Create videos up to 100 seconds</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Runway Extend Video</CardTitle>
          <CardDescription>
            Upload an image and configure your multi-scene video with consistent avatar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Reference Image *</Label>
            <div className="flex items-start gap-4">
              {imagePreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageUrl("");
                      setImageFile(null);
                    }}
                    className="absolute top-1 right-1 p-1 bg-destructive rounded-full"
                  >
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-2">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a clear image of your avatar. This will be used as the starting point for all scenes.
                </p>
                <p className="text-xs text-muted-foreground">
                  Tip: Use a well-lit, front-facing photo for best avatar consistency.
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="avatarName">Avatar Name *</Label>
              <Input
                id="avatarName"
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                placeholder="e.g., John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Real Estate, Fitness, Tech"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City/Location *</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., New York, Los Angeles"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfScenes">Number of Scenes</Label>
              <Select value={numberOfScenes} onValueChange={setNumberOfScenes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} Scene{n > 1 ? 's' : ''} ({n * parseInt(durationPerScene)}s total)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationPerScene">Duration Per Scene</Label>
              <Select value={durationPerScene} onValueChange={setDurationPerScene}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aspectRatio">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p (Faster)</SelectItem>
                  <SelectItem value="1080p">1080p (Higher Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storyIdea">Story Idea</Label>
            <Textarea
              id="storyIdea"
              value={storyIdea}
              onChange={(e) => setStoryIdea(e.target.value)}
              placeholder="Describe the story or message you want to convey in your video..."
              rows={3}
            />
          </div>

          {/* Analyze Button */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Total Duration: <Badge variant="secondary">{totalDuration} seconds</Badge>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !imageUrl || !avatarName || !industry || !city}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Analyze & Generate Scenes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scene Prompts */}
      {scenePrompts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Generated Scenes
            </CardTitle>
            <CardDescription>
              Review and edit the scene prompts before generating your video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenePrompts.map((scene, index) => (
              <Card key={index} className="border-muted">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge>Scene {scene.scene_number}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingScene(editingScene === index ? null : index)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {editingScene === index ? (
                    <div className="space-y-3">
                      <div>
                        <Label>Prompt</Label>
                        <Textarea
                          value={scene.prompt}
                          onChange={(e) => updateScenePrompt(index, 'prompt', e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>Script</Label>
                        <Textarea
                          value={scene.script}
                          onChange={(e) => updateScenePrompt(index, 'script', e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>Camera</Label>
                        <Input
                          value={scene.camera}
                          onChange={(e) => updateScenePrompt(index, 'camera', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p><strong>Prompt:</strong> {scene.prompt}</p>
                      <p className="text-muted-foreground"><strong>Script:</strong> {scene.script}</p>
                      <p className="text-muted-foreground"><strong>Camera:</strong> {scene.camera}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

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
                  <Film className="mr-2 h-4 w-4" />
                  Generate Video ({scenePrompts.length} Scenes)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
