import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";
import { Image, Type } from "lucide-react";

const formSchema = z.object({
  batchName: z.string().min(1, "Batch name is required"),
  imageUrl: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  city: z.string().min(1, "City is required"),
  storyIdea: z.string().optional(),
  model: z.string().default("veo3_fast"),
  aspectRatio: z.string().default("16:9"),
  numberOfScenes: z.number().min(1).max(10).default(3),
});

export type SmartBulkFormData = z.infer<typeof formSchema>;

interface SmartBulkFormProps {
  onUpdate: (data: SmartBulkFormData) => void;
  initialData?: Partial<SmartBulkFormData>;
}

export const SmartBulkForm = ({ onUpdate, initialData }: SmartBulkFormProps) => {
  const [generationMode, setGenerationMode] = useState<"image" | "text">("image");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const form = useForm<SmartBulkFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batchName: initialData?.batchName || "",
      imageUrl: initialData?.imageUrl || "",
      industry: initialData?.industry || "",
      city: initialData?.city || "",
      storyIdea: initialData?.storyIdea || "",
      model: initialData?.model || "veo3_fast",
      aspectRatio: initialData?.aspectRatio || "16:9",
      numberOfScenes: initialData?.numberOfScenes || 3,
    },
  });

  const handlePhotoSelect = (photoId: string | null) => {
    setSelectedPhotoId(photoId);
    // Fetch photo URL if selected
    if (photoId) {
      supabase
        .from("jobsite_photos")
        .select("file_url")
        .eq("id", photoId)
        .single()
        .then(({ data }) => {
          if (data) form.setValue("imageUrl", data.file_url);
        });
    } else {
      form.setValue("imageUrl", "");
    }
  };

  const handleModeChange = (mode: "image" | "text") => {
    setGenerationMode(mode);
    if (mode === "text") {
      form.setValue("imageUrl", "");
      setSelectedPhotoId(null);
    }
  };

  // Watch form values and update parent
  useEffect(() => {
    const subscription = form.watch((values) => {
      onUpdate(values as SmartBulkFormData);
    });
    return () => subscription.unsubscribe();
  }, [form, onUpdate]);

  return (
    <Form {...form}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
            <CardDescription>Name your batch and configure generation settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="batchName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Video Batch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <Label>Generation Mode</Label>
              <RadioGroup
                value={generationMode}
                onValueChange={(v) => handleModeChange(v as "image" | "text")}
                className="grid grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="image" id="mode-image" />
                  <Label htmlFor="mode-image" className="flex items-center gap-2 cursor-pointer">
                    <Image className="h-4 w-4" />
                    Image Reference
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text" id="mode-text" />
                  <Label htmlFor="mode-text" className="flex items-center gap-2 cursor-pointer">
                    <Type className="h-4 w-4" />
                    Text Only
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {generationMode === "image" && (
              <div className="space-y-2">
                <Label>Business Image</Label>
                <SinglePhotoSelector
                  selectedPhotoId={selectedPhotoId}
                  onPhotoSelect={handlePhotoSelect}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Settings</CardTitle>
            <CardDescription>Define the base content for your videos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Roofing" {...field} />
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
                      <Input placeholder="e.g., Austin" {...field} />
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
                      placeholder="Describe the video story... Use {variable_name} for dynamic values"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Video Settings</CardTitle>
            <CardDescription>Configure video output parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="veo3_fast">Veo3 Fast</SelectItem>
                        <SelectItem value="veo3">Veo3 Quality</SelectItem>
                      </SelectContent>
                    </Select>
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
                          <SelectValue placeholder="Select ratio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                        <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numberOfScenes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Scenes</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Scenes" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? "Scene" : "Scenes"}
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
      </div>
    </Form>
  );
};
