import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Video, Wand2, Image, FileText, ArrowRight, ArrowLeft, Check, Type, AlertCircle, CreditCard } from "lucide-react";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import ProgressSteps from "./ProgressSteps";
import FormTips from "./FormTips";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCredits } from "@/hooks/useCredits";
import { checkCredits, reserveCredits } from "@/lib/billing/credits";
import { estimateCreditsForRenderedMinutes, PRICE_PER_CREDIT, calculateCreditPrice } from "@/lib/billing/pricing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const navigate = useNavigate();
  const { balance, hasCredits } = useCredits();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<'image' | 'text'>('image');
  const [formData, setFormData] = useState({
    industry: "",
    avatarName: "",
    city: "",
    storyIdea: "",
    model: "veo3_fast",
    aspectRatio: "16:9",
    watermark: "",
    numberOfScenes: 3
  });
  const [scenePrompts, setScenePrompts] = useState<Array<{ 
    scene_number: number; 
    prompt: string;
    script?: string;
  }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate current step
  const getCurrentStep = () => {
    if (scenePrompts.length > 0) return 3;
    if (generationMode === 'text') {
      if (formData.industry && formData.avatarName && formData.city) return 2;
      return 1;
    }
    if (selectedPhotoId && formData.industry && formData.avatarName && formData.city) return 2;
    if (selectedPhotoId) return 1;
    return 1;
  };

  // Handle mode change
  const handleModeChange = (mode: 'image' | 'text') => {
    setGenerationMode(mode);
    if (mode === 'text') {
      setSelectedPhotoId(null);
    }
  };

  const currentStep = getCurrentStep();

  const handleAnalyze = async () => {
    if (generationMode === 'image' && !selectedPhotoId) {
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
      let imageUrl: string | null = null;
      
      if (generationMode === 'image' && selectedPhotoId) {
        const { data: photoData, error: photoError } = await supabase
          .from('jobsite_photos')
          .select('file_url')
          .eq('id', selectedPhotoId)
          .single();

        if (photoError || !photoData) {
          throw new Error('Failed to get image URL');
        }
        imageUrl = photoData.file_url;
      }

      const { data: responseData, error: responseError } = await supabase.functions.invoke('analyze-image-kie', {
        body: {
          image_url: imageUrl,
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          number_of_scenes: formData.numberOfScenes,
          generation_mode: generationMode
        }
      });

      // Handle errors from the Edge Function
      if (responseError) {
        console.error('Edge function error:', responseError);
        console.error('Error details:', JSON.stringify(responseError, null, 2));
        
        // Try to extract the actual error message
        let errorMessage = responseError.message || 'Failed to analyze image';
        
        // If it's a non-2xx error, the actual error might be in the response data
        if (responseData && typeof responseData === 'object' && 'error' in responseData) {
          errorMessage = (responseData as any).error || errorMessage;
        }
        
        // Show user-friendly error messages
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
          throw new Error('Authentication error: Please log out and log back in.');
        } else if (errorMessage.includes('Missing required fields')) {
          throw new Error('Please fill in all required fields (Industry, Avatar Name, City, and Story Idea).');
        } else if (errorMessage.includes('OpenAI API key') || errorMessage.includes('not configured') || errorMessage.includes('configuration error')) {
          throw new Error('Server configuration error: AI service is not properly configured. Please contact support.');
        } else if (errorMessage.includes('Unable to analyze') || errorMessage.includes('content policy')) {
          throw new Error('The image could not be analyzed. Please try a different image or simplify your marketing story.');
        } else if (errorMessage.includes('non-2xx') || errorMessage.includes('status code')) {
          // Generic server error - show the actual error if we have it
          throw new Error('Server error: ' + (errorMessage.includes('Server error') ? errorMessage : 'Please check your inputs and try again. If the problem persists, contact support.'));
        }
        
        throw new Error(errorMessage);
      }

      // Check if the response indicates failure
      if (!responseData?.success) {
        const errorMsg = responseData?.error || 'AI analysis failed';
        console.error('Analysis failed:', errorMsg);
        
        // Show more specific error messages
        if (errorMsg.includes('Unauthorized')) {
          throw new Error('Authentication error: Please log out and log back in.');
        } else if (errorMsg.includes('Missing required fields')) {
          throw new Error('Please fill in all required fields (Industry, Avatar Name, City, and Story Idea).');
        } else if (errorMsg.includes('OpenAI API key') || errorMsg.includes('not configured')) {
          throw new Error('Server configuration error: AI service is not properly configured. Please contact support.');
        } else if (errorMsg.includes('Unable to analyze')) {
          throw new Error('The image could not be analyzed. Please try a different image or simplify your marketing story.');
        }
        
        throw new Error(errorMsg);
      }

      if (responseData.scenes && Array.isArray(responseData.scenes)) {
        setScenePrompts(responseData.scenes);
      } else {
        setScenePrompts([{ scene_number: 1, prompt: responseData.prompt }]);
      }

      toast({
        title: "✨ Prompts Generated!",
        description: `AI created ${formData.numberOfScenes} scene prompts. Review and edit as needed.`,
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
        description: "Please generate prompts first.",
        variant: "destructive"
      });
      return;
    }

    // Estimate rendered minutes: each scene is ~8 seconds (keep as float; credits math handles rounding)
    const estimatedRenderedMinutes = (scenePrompts.length * 8) / 60; // 8 seconds per scene
    const requiredCredits = estimateCreditsForRenderedMinutes(estimatedRenderedMinutes);

    // Check credits before starting
    try {
      const creditCheck = await checkCredits(estimatedRenderedMinutes);
      
      if (!creditCheck.hasCredits) {
        const estimatedCost = calculateCreditPrice(requiredCredits);
        toast({
          title: "Insufficient Credits",
          description: `You need ${requiredCredits} credits but only have ${creditCheck.currentBalance}. Please buy more credits to continue.`,
          variant: "destructive",
          duration: 8000,
        });
        navigate("/checkout?mode=credits");
        return;
      }
    } catch (error) {
      console.error("Error checking credits:", error);
      toast({
        title: "Error",
        description: "Failed to check credit balance. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      let imageUrl: string | null = null;
      
      if (generationMode === 'image' && selectedPhotoId) {
        const { data: photoData, error: photoError } = await supabase
          .from('jobsite_photos')
          .select('file_url')
          .eq('id', selectedPhotoId)
          .single();

        if (photoError || !photoData) {
          throw new Error('Failed to get image URL');
        }
        imageUrl = photoData.file_url;
      }

      const isMultiScene = scenePrompts.length > 1;
      const generationType = generationMode === 'image' ? 'REFERENCE_2_VIDEO' : 'TEXT_2_VIDEO';

      const { data: generation, error: insertError } = await supabase
        .from('kie_video_generations')
        .insert({
          user_id: userId,
          image_url: imageUrl || 'text-to-video',
          industry: formData.industry,
          avatar_name: formData.avatarName,
          city: formData.city,
          story_idea: formData.storyIdea,
          ai_prompt: scenePrompts[0].prompt,
          model: formData.model,
          aspect_ratio: formData.aspectRatio,
          watermark: formData.watermark || null,
          number_of_scenes: scenePrompts.length,
          scene_prompts: scenePrompts,
          current_scene: 1,
          is_multi_scene: isMultiScene,
          metadata: { generation_type: generationType }
        })
        .select()
        .single();

      if (insertError || !generation) {
        throw new Error('Failed to create generation record');
      }

      // Reserve credits for this generation
      const reserveResult = await reserveCredits(
        generation.id,
        'kie',
        estimatedRenderedMinutes,
        { scene_count: scenePrompts.length }
      );

      if (!reserveResult.success) {
        // Delete generation record if credit reservation fails
        await supabase.from('kie_video_generations').delete().eq('id', generation.id);
        throw new Error(reserveResult.error || 'Failed to reserve credits');
      }

      const firstScenePrompt = scenePrompts[0].prompt;
      const firstSceneScript = scenePrompts[0].script || '';
      
      const enhancedPrompt = firstSceneScript 
        ? `${firstScenePrompt}\n\nAVATAR DIALOGUE: The person speaks these words: "${firstSceneScript}"`
        : firstScenePrompt;

      const { data: generateData, error: generateError } = await supabase.functions.invoke('kie-generate-video', {
        body: {
          generation_id: generation.id,
          prompt: enhancedPrompt,
          image_url: imageUrl,
          model: formData.model,
          aspect_ratio: formData.aspectRatio,
          watermark: formData.watermark || '',
          generation_type: generationType
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
        title: "🎬 Video Generation Started!",
        description: isMultiScene 
          ? `Generating ${scenePrompts.length} scenes. Track progress on your Dashboard.`
          : "Your video is being generated. Track progress on your Dashboard.",
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
    <div className="max-w-4xl space-y-6">
      {/* Progress Steps */}
      <ProgressSteps currentStep={currentStep} />

      {/* Tips */}
      <FormTips step={currentStep} />

      {/* Step 1 & 2: Input Form */}
      <Card className={scenePrompts.length > 0 ? "opacity-75" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            Step 1 & 2: Upload Image & Provide Details
          </CardTitle>
          <CardDescription>
            Upload a high-quality image and tell us about your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generation Mode Selector */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Generation Mode</Label>
            <RadioGroup
              value={generationMode}
              onValueChange={(value) => handleModeChange(value as 'image' | 'text')}
              className="grid grid-cols-2 gap-4"
            >
              <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${generationMode === 'image' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="image" id="mode-image" />
                <Label htmlFor="mode-image" className="cursor-pointer flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Image Reference</div>
                    <div className="text-xs text-muted-foreground">16:9 or 9:16</div>
                  </div>
                </Label>
              </div>
              <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${generationMode === 'text' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="text" id="mode-text" />
                <Label htmlFor="mode-text" className="cursor-pointer flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Prompt Only</div>
                    <div className="text-xs text-muted-foreground">16:9 or 9:16</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Image Upload Section - Only show for image mode */}
          {generationMode === 'image' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Business Image *
              </Label>
              <SinglePhotoSelector
                selectedPhotoId={selectedPhotoId}
                onPhotoSelect={setSelectedPhotoId}
              />
              <p className="text-xs text-muted-foreground">
                Use a high-resolution image with good lighting for best results
              </p>
            </div>
          )}

          {/* Business Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Industry *
              </Label>
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
                  <SelectItem value="7">7 Scenes (56s total)</SelectItem>
                  <SelectItem value="8">8 Scenes (64s total)</SelectItem>
                  <SelectItem value="9">9 Scenes (72s total)</SelectItem>
                  <SelectItem value="10">10 Scenes (80s total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Story Idea - Full Width */}
          <div className="space-y-2">
            <Label htmlFor="storyIdea">Marketing Story Idea *</Label>
            <Textarea
              id="storyIdea"
              value={formData.storyIdea}
              onChange={(e) => setFormData({ ...formData, storyIdea: e.target.value })}
              placeholder="e.g., Show how our roofing service transforms old homes, highlighting quality, speed, and customer satisfaction"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Describe your marketing message (problem → solution, before → after, customer journey)
            </p>
          </div>

          {/* Video Settings */}
          <div className="grid gap-4 md:grid-cols-3">
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
                  <SelectItem value="16:9">16:9 (Landscape - YouTube, TV)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait - TikTok, Reels)</SelectItem>
                  {generationMode === 'text' && (
                    <SelectItem value="Auto">Auto (Based on content)</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.aspectRatio === '9:16'
                  ? 'Portrait format for TikTok, Instagram Reels, Stories.'
                  : formData.aspectRatio === '16:9'
                    ? 'Landscape format for YouTube, presentations.'
                    : 'Aspect ratio is chosen based on content.'}
              </p>
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
            disabled={isAnalyzing || scenePrompts.length > 0}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing with AI...
              </>
            ) : scenePrompts.length > 0 ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Prompts Generated - Review Below
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Prompts
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 3: Review Scene Prompts */}
      {scenePrompts.length > 0 && (
        <Card className="border-primary/50 shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Video className="h-5 w-5" />
              </div>
              Step 3: Review & Edit Scene Prompts
            </CardTitle>
            <CardDescription>
              AI generated {scenePrompts.length} scene prompts. Edit any scene before generating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {/* Scene Prompts */}
            {scenePrompts.map((scene, index) => (
              <div key={scene.scene_number} className="space-y-3 p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {scene.scene_number}
                  </span>
                  <Label className="text-base font-semibold">
                    Scene {scene.scene_number} of {scenePrompts.length}
                  </Label>
                  <span className="text-sm text-muted-foreground ml-auto">~8 seconds</span>
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

            {/* Summary & Generate */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Total video duration: <strong>{scenePrompts.length * 8} seconds</strong> ({scenePrompts.length} scenes × 8s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScenePrompts([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
              </div>

              {/* Credit Info */}
              {scenePrompts.length > 0 && (
                <div className="space-y-2">
                  {(() => {
                    const estimatedRenderedMinutes = (scenePrompts.length * 8) / 60;
                    const requiredCredits = estimateCreditsForRenderedMinutes(estimatedRenderedMinutes);
                    const estimatedCost = calculateCreditPrice(requiredCredits);
                    const hasEnough = balance && hasCredits(requiredCredits);
                    
                    return (
                      <div className="p-4 bg-muted/50 rounded-[10px] space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Estimated rendered:</span>
                          <span className="font-medium">{estimatedRenderedMinutes.toFixed(2)} minutes</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Estimated credits:</span>
                          <span className={`font-semibold ${hasEnough ? 'text-foreground' : 'text-destructive'}`}>
                            {requiredCredits} credits
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Estimated cost:</span>
                          <span>${estimatedCost.toFixed(2)}</span>
                        </div>
                        {balance && (
                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <span className="text-muted-foreground">Your balance:</span>
                            <span className="font-medium">{balance.credits.toLocaleString()} credits</span>
                          </div>
                        )}
                        {!hasEnough && balance && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Insufficient Credits</AlertTitle>
                            <AlertDescription className="text-xs">
                              You need {requiredCredits} credits but only have {balance.credits}. 
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 ml-1 text-xs underline"
                                onClick={() => navigate("/checkout?mode=credits")}
                              >
                                Buy credits
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (scenePrompts.length > 0 && balance && !hasCredits(estimateCreditsForRenderedMinutes((scenePrompts.length * 8) / 60)))}
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
