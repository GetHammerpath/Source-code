import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Upload, FileText, Play, CheckCircle2, AlertCircle, 
  Wand2, Film, Settings, Link2, ArrowRight, ArrowLeft,
  Upload as UploadIcon, Loader2, Video, Sparkles, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import StudioHeader from "@/components/layout/StudioHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type WorkflowStep = "ingest" | "storyboard" | "render" | "assemble";

interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  prompt: string;
  provider: "kie" | "fal" | "custom";
  status: "pending" | "generating" | "completed" | "failed";
  videoUrl?: string;
  duration?: number;
}

const LongFormGenerator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("ingest");
  
  // Ingest state
  const [uploadType, setUploadType] = useState<"brief" | "url" | "transcript">("brief");
  const [brief, setBrief] = useState("");
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  
  // Storyboard state
  const [numberOfScenes, setNumberOfScenes] = useState(8);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingStoryboard, setIsCreatingStoryboard] = useState(false);

  // Scene duration in seconds (typically 8 seconds per scene)
  const SCENE_DURATION_SECONDS = 8;
  const estimatedTimeSeconds = numberOfScenes * SCENE_DURATION_SECONDS;
  const estimatedTimeMinutes = Math.floor(estimatedTimeSeconds / 60);
  const estimatedTimeRemainingSeconds = estimatedTimeSeconds % 60;
  const formattedTime = `${estimatedTimeMinutes}:${estimatedTimeRemainingSeconds.toString().padStart(2, '0')}`;

  const handleIngest = async () => {
    const input = uploadType === "brief" ? brief : uploadType === "url" ? url : transcript;
    
    if (!input) {
      toast({
        title: "Input Required",
        description: "Please provide a brief, URL, or transcript.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingScript(true);
    
    try {
      // Call Edge Function to generate script from limited input
      const { data, error } = await supabase.functions.invoke("generate-longform-script", {
        body: {
          input_type: uploadType,
          input: input,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to generate script");
      }

      setGeneratedScript(data.script || "");
      
      // If script was generated, move to storyboard step
      if (data.script) {
        toast({
          title: "Script Generated!",
          description: "AI created a script from your input. Adjust scene count and proceed to storyboard.",
        });
        // Don't auto-advance, let user review script first
      }
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast({
        title: "Script Generation Failed",
        description: error.message || "Failed to generate script. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleCreateStoryboard = async () => {
    if (!generatedScript) {
      toast({
        title: "Script Required",
        description: "Please generate a script first.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingStoryboard(true);
    
    try {
      // Call Edge Function to create storyboard from script
      const { data, error } = await supabase.functions.invoke("create-longform-storyboard", {
        body: {
          script: generatedScript,
          number_of_scenes: numberOfScenes,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to create storyboard");
      }

      // Convert response to Scene objects
      const generatedScenes: Scene[] = (data.scenes || []).map((scene: any, i: number) => ({
        id: `scene-${i + 1}`,
        sceneNumber: i + 1,
        title: scene.title || scene.scene_title || `Scene ${i + 1}`,
        prompt: scene.prompt || scene.description || scene.scene || "",
        provider: i % 2 === 0 ? "kie" : "fal", // Default provider assignment
        status: "pending" as const,
        duration: SCENE_DURATION_SECONDS,
      }));

      setScenes(generatedScenes);
      setCurrentStep("storyboard");
      
      toast({
        title: "Storyboard Created!",
        description: `Generated ${generatedScenes.length} scenes. Review and adjust as needed.`,
      });
    } catch (error: any) {
      console.error("Error creating storyboard:", error);
      toast({
        title: "Storyboard Creation Failed",
        description: error.message || "Failed to create storyboard. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStoryboard(false);
    }
  };

  const handleProviderChange = (sceneId: string, provider: "kie" | "fal" | "custom") => {
    setScenes(scenes.map(s => 
      s.id === sceneId ? { ...s, provider } : s
    ));
  };

  const handleStartRender = () => {
    setCurrentStep("render");
    setIsGenerating(true);
    
    // Simulate rendering progress
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < scenes.length) {
        setScenes(prev => prev.map((s, i) => 
          i === currentIndex 
            ? { ...s, status: "generating" as const }
            : s
        ));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsGenerating(false);
        toast({
          title: "Rendering Complete",
          description: "All scenes have been rendered. Ready for assembly.",
        });
        setTimeout(() => setCurrentStep("assemble"), 1000);
      }
    }, 1500);
  };

  const completedScenes = scenes.filter(s => s.status === "completed").length;
  const totalScenes = scenes.length;

  return (
    <div className="h-full w-full bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-8">
        <StudioHeader
          title="Long-Form Video Generator"
          subtitle="Create minutes-to-hours of video with multi-scene orchestration"
        />

        {/* Workflow Steps */}
        <Tabs value={currentStep} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="ingest" disabled={currentStep !== "ingest"}>
              1. Ingest
            </TabsTrigger>
            <TabsTrigger value="storyboard" disabled={scenes.length === 0}>
              2. Storyboard
            </TabsTrigger>
            <TabsTrigger value="render" disabled={scenes.length === 0}>
              3. Render
            </TabsTrigger>
            <TabsTrigger value="assemble" disabled={completedScenes === 0}>
              4. Assemble
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Ingest */}
          <TabsContent value="ingest" className="space-y-6">
            <Card className="rounded-[14px]">
              <CardHeader>
                <CardTitle>Create Your Video</CardTitle>
                <CardDescription>
                  Provide a brief description, URL, or transcript. AI will generate a complete script.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <Button
                    variant={uploadType === "brief" ? "default" : "outline"}
                    onClick={() => setUploadType("brief")}
                    className="rounded-[14px]"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Brief
                  </Button>
                  <Button
                    variant={uploadType === "url" ? "default" : "outline"}
                    onClick={() => setUploadType("url")}
                    className="rounded-[14px]"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    URL
                  </Button>
                  <Button
                    variant={uploadType === "transcript" ? "default" : "outline"}
                    onClick={() => setUploadType("transcript")}
                    className="rounded-[14px]"
                  >
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Transcript
                  </Button>
                </div>

                {uploadType === "brief" && (
                  <div className="space-y-2">
                    <Label>Brief Description</Label>
                    <Textarea
                      placeholder="E.g., 'A 5-minute video about a roofing company in Austin showcasing their services, expertise, and customer testimonials'"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      rows={8}
                      className="rounded-[14px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Describe what you want your video to be about. AI will create a full script.
                    </p>
                  </div>
                )}

                {uploadType === "url" && (
                  <div className="space-y-2">
                    <Label>Blog URL or Article Link</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/article"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="rounded-[14px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      AI will extract content and create a script.
                    </p>
                  </div>
                )}

                {uploadType === "transcript" && (
                  <div className="space-y-2">
                    <Label>Podcast Transcript</Label>
                    <Textarea
                      placeholder="Paste transcript here..."
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={12}
                      className="rounded-[14px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      AI will structure the transcript into a video script.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleIngest}
                  disabled={isGeneratingScript || (!brief && !url && !transcript)}
                  className="w-full rounded-[14px]"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Script with AI
                    </>
                  )}
                </Button>

                {/* Show generated script if available */}
                {generatedScript && (
                  <Card className="rounded-[14px] border-primary/20 bg-primary/5 mt-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Generated Script</CardTitle>
                      <CardDescription>
                        Review the AI-generated script before proceeding to storyboard
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={generatedScript}
                        onChange={(e) => setGeneratedScript(e.target.value)}
                        rows={12}
                        className="rounded-[14px] font-mono text-sm"
                        readOnly={false}
                      />
                      <Button
                        onClick={handleCreateStoryboard}
                        disabled={isCreatingStoryboard}
                        className="w-full rounded-[14px] mt-4"
                        size="lg"
                      >
                        {isCreatingStoryboard ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Storyboard...
                          </>
                        ) : (
                          <>
                            Proceed to Storyboard
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 2: Storyboard */}
          <TabsContent value="storyboard" className="space-y-6">
            <Card className="rounded-[14px]">
              <CardHeader>
                <CardTitle>Scene Breakdown</CardTitle>
                <CardDescription>
                  Adjust scene count and review scenes. Select provider per scene for optimal results.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scene Count Selector */}
                <div className="space-y-4 p-4 bg-muted/50 rounded-[14px] border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Number of Scenes</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{numberOfScenes}</span>
                      <span className="text-sm text-muted-foreground">scenes</span>
                    </div>
                  </div>
                  <Slider
                    value={[numberOfScenes]}
                    onValueChange={(value) => setNumberOfScenes(value[0])}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Minimum: 1 scene</span>
                    <span>Maximum: 50 scenes</span>
                  </div>
                  
                  {/* Time Estimation */}
                  <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Estimated video duration:</span>
                    </div>
                    <span className="text-lg font-semibold">{formattedTime}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on {SCENE_DURATION_SECONDS} seconds per scene
                  </div>
                </div>

                {scenes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-4">No scenes yet. Generate a script first.</p>
                    <Button
                      onClick={() => setCurrentStep("ingest")}
                      variant="outline"
                      className="rounded-[14px]"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Ingest
                    </Button>
                  </div>
                ) : (
                  <>
                    {scenes.map((scene) => (
                      <div
                        key={scene.id}
                        className="p-4 rounded-[14px] border border-border/50 bg-card space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">Scene {scene.sceneNumber}</Badge>
                              <span className="font-semibold">{scene.title}</span>
                              <span className="text-xs text-muted-foreground">
                                • {scene.duration || SCENE_DURATION_SECONDS}s
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{scene.prompt}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Label className="text-xs">Provider:</Label>
                          <select
                            value={scene.provider}
                            onChange={(e) => handleProviderChange(scene.id, e.target.value as any)}
                            className="rounded-[10px] border border-border/50 px-3 py-1.5 text-sm bg-background"
                          >
                            <option value="kie">Kie.ai</option>
                            <option value="fal">fal.ai</option>
                            <option value="custom">Custom Provider</option>
                          </select>
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep("ingest")}
                        className="rounded-[14px]"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        onClick={handleStartRender}
                        className="flex-1 rounded-[14px]"
                        size="lg"
                      >
                        Start Rendering
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 3: Render */}
          <TabsContent value="render" className="space-y-6">
            <Card className="rounded-[14px]">
              <CardHeader>
                <CardTitle>Render Queue</CardTitle>
                <CardDescription>
                  Rendering scenes across providers with intelligent queue management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={`p-4 rounded-[14px] border ${
                      scene.status === "generating"
                        ? "border-primary/50 bg-primary/5"
                        : scene.status === "completed"
                        ? "border-success/50 bg-success/5"
                        : "border-border/50 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {scene.status === "generating" && (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        )}
                        {scene.status === "completed" && (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        )}
                        {scene.status === "pending" && (
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="font-semibold">Scene {scene.sceneNumber}: {scene.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Provider: {scene.provider.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          scene.status === "completed" ? "default" : 
                          scene.status === "generating" ? "secondary" : 
                          "outline"
                        }
                      >
                        {scene.status}
                      </Badge>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-semibold">
                      {completedScenes} / {totalScenes} scenes completed
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300"
                      style={{ width: `${totalScenes > 0 ? (completedScenes / totalScenes) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 4: Assemble */}
          <TabsContent value="assemble" className="space-y-6">
            <Card className="rounded-[14px]">
              <CardHeader>
                <CardTitle>Timeline Assembly</CardTitle>
                <CardDescription>
                  Final timeline with captions, audio mixing, and transitions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Video Timeline
                  </div>
                  {scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="h-16 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[10px] border border-border/50 flex items-center px-4"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">Scene {scene.sceneNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {scene.duration || SCENE_DURATION_SECONDS}s • {scene.provider.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">All scenes rendered</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">Captions generated</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">Audio mixed</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("render")}
                    className="rounded-[14px]"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-[14px]"
                    size="lg"
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Export Video
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LongFormGenerator;
