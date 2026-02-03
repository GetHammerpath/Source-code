import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Wand2, Eye, Play, Image as ImageIcon, FileText } from "lucide-react";
import VariableManager, { Variable } from "./VariableManager";
import VariationPreview, { calculateCombinations } from "./VariationPreview";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";

const formSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  imageUrl: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  city: z.string().min(1, "City is required"),
  storyIdea: z.string().optional(),
  model: z.string().default("veo3_fast"),
  aspectRatio: z.string().default("16:9"),
  numberOfScenes: z.number().min(1).max(10).default(3),
});

type FormData = z.infer<typeof formSchema>;

interface BulkVideoFormProps {
  userId: string;
  onBatchCreated: (batchId: string) => void;
}


const BulkVideoForm = ({ userId, onBatchCreated }: BulkVideoFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [activeTab, setActiveTab] = useState("config");
  const [generationMode, setGenerationMode] = useState<'image' | 'text'>('image');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
      industry: "",
      city: "",
      storyIdea: "",
      model: "veo3_fast",
      aspectRatio: "16:9",
      numberOfScenes: 3,
    },
  });

  const handlePhotoSelect = async (photoId: string | null) => {
    setSelectedPhotoId(photoId);
    if (photoId) {
      const { data } = await supabase
        .from("jobsite_photos")
        .select("file_url")
        .eq("id", photoId)
        .single();
      if (data) {
        form.setValue("imageUrl", data.file_url);
      }
    } else {
      form.setValue("imageUrl", "");
    }
  };

  const handleModeChange = (mode: 'image' | 'text') => {
    setGenerationMode(mode);
    if (mode === 'text') {
      // Clear image selection when switching to text mode
      setSelectedPhotoId(null);
      form.setValue("imageUrl", "");
    }
    // Reset aspect ratio to default when switching modes
    form.setValue("aspectRatio", "16:9");
  };

  const onSubmit = async (data: FormData) => {
    // Validate image is selected in image mode
    if (generationMode === 'image' && !data.imageUrl) {
      toast({
        title: "Image required",
        description: "Please select or upload a business image for Image Reference mode",
        variant: "destructive",
      });
      return;
    }

    const combinations = calculateCombinations(variables);
    
    if (combinations.length === 0 || (combinations.length === 1 && Object.keys(combinations[0]).length === 0)) {
      toast({
        title: "No variations defined",
        description: "Please add at least one variable with values",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const generationType = generationMode === 'image' ? 'REFERENCE_2_VIDEO' : 'TEXT_2_VIDEO';
      
      // Create the batch
      const { data: batch, error: batchError } = await supabase
        .from("bulk_video_batches")
        .insert([{
          user_id: userId,
          name: data.name,
          base_image_url: generationMode === 'image' ? data.imageUrl : null,
          base_industry: data.industry,
          base_city: data.city,
          base_story_idea: data.storyIdea || null,
          variables: JSON.parse(JSON.stringify(variables)),
          total_variations: combinations.length,
          model: data.model,
          aspect_ratio: data.aspectRatio,
          number_of_scenes: data.numberOfScenes,
          status: "generating",
          generation_type: generationType,
        }])
        .select()
        .single();

      if (batchError) throw batchError;

      // Fire the Edge Function without awaiting fully (avoids timeout for large batches).
      const invokePromise = supabase.functions.invoke("bulk-generate-videos", {
        body: {
          batch_id: batch.id,
          combinations,
          base_config: {
            image_url: generationMode === 'image' ? data.imageUrl : null,
            generation_type: generationType,
            industry: data.industry,
            city: data.city,
            story_idea: data.storyIdea,
            model: data.model,
            aspect_ratio: data.aspectRatio,
            number_of_scenes: data.numberOfScenes,
          },
        },
      });

      const result = await Promise.race([
        invokePromise,
        new Promise<{ error: Error | null; data?: { started?: number; failed?: number } }>((resolve) =>
          setTimeout(() => resolve({ error: null }), 8000)
        ),
      ]);
      const funcError = result && typeof result === "object" && "error" in result ? result.error : null;
      if (funcError) throw funcError;

      const data = result && typeof result === "object" && "data" in result ? (result as { data?: { started?: number; failed?: number } }).data : undefined;
      const started = data?.started;
      const failed = data?.failed;
      const description =
        started !== undefined && failed !== undefined
          ? `${started} started, ${failed} failed.${failed > 0 ? " Check the batch page for error details." : ""}`
          : `Creating ${combinations.length} video variations`;
      toast({
        title: "Bulk generation started!",
        description,
        ...(failed != null && failed > 0 && { variant: "destructive" }),
      });

      onBatchCreated(batch.id);
      form.reset();
      setVariables([]);
      setSelectedPhotoId(null);
      setGenerationMode('image');
    } catch (error) {
      console.error("Error creating batch:", error);
      toast({
        title: "Failed to start bulk generation",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const combinations = calculateCombinations(variables);
  const variationCount = variables.some((v) => v.values.length > 0) ? combinations.length : 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Base Config
            </TabsTrigger>
            <TabsTrigger value="variables" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Variables
              {variationCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {variationCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Base Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Q1 Marketing Campaign" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Generation Mode Selection */}
                <div className="space-y-3">
                  <Label>Generation Mode</Label>
                  <RadioGroup
                    value={generationMode}
                    onValueChange={(value) => handleModeChange(value as 'image' | 'text')}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="mode-image"
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        generationMode === 'image'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="image" id="mode-image" />
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Image Reference</p>
                          <p className="text-xs text-muted-foreground">Use a reference image (16:9)</p>
                        </div>
                      </div>
                    </Label>
                    <Label
                      htmlFor="mode-text"
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        generationMode === 'text'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="text" id="mode-text" />
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Prompt Only</p>
                          <p className="text-xs text-muted-foreground">Text-based generation</p>
                        </div>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>

                {/* Business Image Selection - only show in image mode */}
                {generationMode === 'image' && (
                  <div className="space-y-2">
                    <Label>Business Image</Label>
                    <SinglePhotoSelector
                      selectedPhotoId={selectedPhotoId}
                      onPhotoSelect={handlePhotoSelect}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Roofing, HVAC, Plumbing" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Austin, TX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="storyIdea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Story Idea (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the video concept. Use {avatar_name}, {background}, etc. for variable substitution..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="veo3_fast">Veo3 Fast</SelectItem>
                            <SelectItem value="veo3">Veo3 Quality</SelectItem>
                          </SelectContent>
                        </Select>
                        {generationMode === "image" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Image mode uses Fast (provider does not support Quality for image-to-video).
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aspectRatio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aspect Ratio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                            {generationMode === 'text' && (
                              <>
                                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                                <SelectItem value="auto">Auto</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        {generationMode === 'image' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Image mode requires 16:9
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numberOfScenes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scenes</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n} {n === 1 ? "scene" : "scenes"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variables" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Define Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <VariableManager variables={variables} onChange={setVariables} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <VariationPreview
                  variables={variables}
                  baseConfig={{
                    industry: form.watch("industry"),
                    city: form.watch("city"),
                    storyIdea: form.watch("storyIdea"),
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || variationCount === 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting Bulk Generation...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate {variationCount} Video Variations
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

export default BulkVideoForm;