import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { SaveTemplateDialog } from "@/components/templates/SaveTemplateDialog";
import QuickRequestForm from "@/components/forms/QuickRequestForm";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";

const NewRequest = () => {
  const [loading, setLoading] = useState(false);
  const [requestMode, setRequestMode] = useState<'detailed' | 'quick'>('detailed');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    caption: "",
    storyIdea: "",
    companyName: "",
    cityCommunity: "",
    companyType: "",
    character: "",
    visualStyle: "realistic",
    colors: "",
    specialRequest: "",
    genderAvatar: "neutral",
    scenes: 5,
    aspectRatio: "16:9",
    renderMode: "veo3_fast",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadTemplateFromState();
  }, []);

  const loadTemplateFromState = () => {
    const state = location.state as { template?: any };
    if (state?.template) {
      applyTemplate(state.template);
    }
  };

  const applyTemplate = (template: any) => {
    setFormData({
      title: template.title || "",
      caption: template.caption || "",
      storyIdea: template.story_idea || "",
      companyName: template.client_company_name || "",
      cityCommunity: template.city_community || "",
      companyType: template.company_type || "",
      character: template.character || "",
      visualStyle: template.visual_style || "realistic",
      colors: template.colors || "",
      specialRequest: template.special_request || "",
      genderAvatar: template.gender_avatar || "neutral",
      scenes: template.scenes || 5,
      aspectRatio: template.aspect_ratio || "16:9",
      renderMode: template.render_mode || "veo3_fast",
    });

    toast({
      title: "Template loaded",
      description: `Applied "${template.name}" template to the form.`,
    });
  };

  const handleQuickRequestComplete = (generatedData: any, photoId: string | null) => {
    setFormData({
      title: generatedData.title || "",
      caption: generatedData.caption || "",
      storyIdea: generatedData.story_idea || "",
      companyName: generatedData.client_company_name || "",
      cityCommunity: generatedData.city_community || "",
      companyType: generatedData.company_type || "",
      character: generatedData.character || "",
      visualStyle: generatedData.visual_style || "realistic",
      colors: generatedData.colors || "",
      specialRequest: formData.specialRequest,
      genderAvatar: generatedData.gender_avatar || "neutral",
      scenes: generatedData.scenes || 5,
      aspectRatio: generatedData.aspect_ratio || "16:9",
      renderMode: generatedData.render_mode || "veo3_fast",
    });
    setSelectedPhotoId(photoId);
    setRequestMode('detailed');
    
    toast({
      title: "AI Brief Generated",
      description: "Review and edit the generated fields, then submit your request.",
    });
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Create the video request
      const { data: request, error: requestError } = await supabase
        .from("video_requests")
        .insert({
          user_id: session.user.id,
          title: formData.title,
          caption: formData.caption || null,
          story_idea: formData.storyIdea || null,
          client_company_name: formData.companyName,
          company_type: formData.companyType as any,
          city_community: formData.cityCommunity || formData.companyName,
          character: formData.character,
          visual_style: formData.visualStyle as any,
          colors: formData.colors || null,
          gender_avatar: formData.genderAvatar as any,
          scenes: formData.scenes,
          aspect_ratio: formData.aspectRatio as any,
          render_mode: formData.renderMode as any,
          special_request: formData.specialRequest || null,
          status: "queued" as any,
        } as any)
        .select()
        .single();

      if (requestError) throw requestError;

      // Link selected photo to request if one was selected
      let photoUrl: string | null = null;
      if (selectedPhotoId) {
        const { error: linkError } = await supabase
          .from("request_selected_photos")
          .insert({
            request_id: request.id,
            photo_id: selectedPhotoId,
          });

        if (linkError) {
          console.error("Error linking photo:", linkError);
        } else {
          // Get the photo URL for the workflow
          const { data: photoData } = await supabase
            .from("jobsite_photos")
            .select("file_url")
            .eq("id", selectedPhotoId)
            .single();
          
          if (photoData) {
            photoUrl = photoData.file_url;
          }
        }
      }

      // Trigger n8n workflow
      try {
        await supabase.functions.invoke("trigger-n8n-workflow", {
          body: {
            request_id: request.id,
            title: formData.title,
            caption: formData.caption,
            story_idea: formData.storyIdea,
            company_name: formData.companyName,
            company_type: formData.companyType,
            character: formData.character,
            visual_style: formData.visualStyle,
            colors: formData.colors,
            special_request: formData.specialRequest,
            gender_avatar: formData.genderAvatar,
            image_reference: photoUrl ? [photoUrl] : [],
            scenes: formData.scenes,
            aspect_ratio: formData.aspectRatio,
            render_mode: formData.renderMode,
            created_at: request.created_at,
          },
        });
      } catch (workflowError) {
        console.error("Error triggering n8n workflow:", workflowError);
        // Don't fail the request if workflow trigger fails
      }

      toast({
        title: "Success",
        description: "Video request created successfully",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          {/* Mode Toggle */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Request Mode</CardTitle>
              <CardDescription>
                Choose how you want to create your video request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={requestMode} onValueChange={(value: any) => setRequestMode(value)}>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="detailed" id="detailed" />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="detailed" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">Detailed Form</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Full control - manually fill all creative and technical fields
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="quick" id="quick" />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="quick" className="flex items-center gap-2 cursor-pointer">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium">Quick Request (AI-Powered)</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Upload image + basic info → AI generates creative brief
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {requestMode === 'quick' ? (
            <QuickRequestForm 
              onComplete={handleQuickRequestComplete}
              onCancel={() => setRequestMode('detailed')}
            />
          ) : (
            <>
              <TemplateSelector onSelectTemplate={applyTemplate} />

              <Card>
            <CardHeader>
              <CardTitle className="text-2xl">New Video Request</CardTitle>
              <CardDescription>
                Create a comprehensive video production brief
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Project Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Project Details</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="title">Video Title*</Label>
                    <Input
                      id="title"
                      required
                      placeholder="e.g., Summer Roofing Promo"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caption">Caption / Tagline</Label>
                    <Input
                      id="caption"
                      placeholder="Short subtitle or tagline"
                      value={formData.caption}
                      onChange={(e) =>
                        setFormData({ ...formData, caption: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name*</Label>
                      <Input
                        id="companyName"
                        required
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData({ ...formData, companyName: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cityCommunity">City / Community*</Label>
                      <Input
                        id="cityCommunity"
                        required
                        placeholder="e.g., Austin, TX"
                        value={formData.cityCommunity}
                        onChange={(e) =>
                          setFormData({ ...formData, cityCommunity: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyType">Industry Type*</Label>
                      <Select
                        required
                        value={formData.companyType}
                        onValueChange={(value) =>
                          setFormData({ ...formData, companyType: value })
                        }
                      >
                        <SelectTrigger id="companyType">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="roofing">Roofing</SelectItem>
                          <SelectItem value="gutter">Gutter</SelectItem>
                          <SelectItem value="christmas_lights">Christmas Lights</SelectItem>
                          <SelectItem value="landscaping">Landscaping</SelectItem>
                          <SelectItem value="painting">Painting</SelectItem>
                          <SelectItem value="power_washing">Power Washing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Creative Direction Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Creative Direction</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="storyIdea">Story Idea / Script Direction</Label>
                    <Textarea
                      id="storyIdea"
                      placeholder="Describe the narrative, key messages, or storyline..."
                      value={formData.storyIdea}
                      onChange={(e) =>
                        setFormData({ ...formData, storyIdea: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="character">Character / Avatar Role*</Label>
                    <Input
                      id="character"
                      required
                      placeholder="e.g., Professional contractor, friendly expert"
                      value={formData.character}
                      onChange={(e) =>
                        setFormData({ ...formData, character: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Visual Style*</Label>
                    <RadioGroup
                      value={formData.visualStyle}
                      onValueChange={(value) =>
                        setFormData({ ...formData, visualStyle: value })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="realistic" id="realistic" />
                        <Label htmlFor="realistic" className="font-normal cursor-pointer">
                          Realistic - Photorealistic AI-generated visuals
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cartoonized" id="cartoonized" />
                        <Label htmlFor="cartoonized" className="font-normal cursor-pointer">
                          Cartoonized - Stylized, animated look
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colors">Color Palette</Label>
                    <Input
                      id="colors"
                      placeholder="e.g., Blue and white, warm earth tones, brand colors"
                      value={formData.colors}
                      onChange={(e) =>
                        setFormData({ ...formData, colors: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Avatar Configuration Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Avatar Configuration</h3>
                  
                  <div className="space-y-3">
                    <Label>Avatar Gender*</Label>
                    <RadioGroup
                      value={formData.genderAvatar}
                      onValueChange={(value) =>
                        setFormData({ ...formData, genderAvatar: value })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <Label htmlFor="male" className="font-normal cursor-pointer">Male</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <Label htmlFor="female" className="font-normal cursor-pointer">Female</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="neutral" id="neutral" />
                        <Label htmlFor="neutral" className="font-normal cursor-pointer">Neutral / Non-binary</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                {/* Technical Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Technical Settings</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>Number of Scenes: {formData.scenes}</Label>
                    </div>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[formData.scenes]}
                      onValueChange={(value) =>
                        setFormData({ ...formData, scenes: value[0] })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Adjust the number of scenes in your video (1-10)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Aspect Ratio*</Label>
                    <RadioGroup
                      value={formData.aspectRatio}
                      onValueChange={(value) =>
                        setFormData({ ...formData, aspectRatio: value })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="16:9" id="16:9" />
                        <Label htmlFor="16:9" className="font-normal cursor-pointer">
                          16:9 - Landscape (YouTube, presentations)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="9:16" id="9:16" />
                        <Label htmlFor="9:16" className="font-normal cursor-pointer">
                          9:16 - Portrait (TikTok, Instagram Reels)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="renderMode">Render Quality*</Label>
                    <Select
                      required
                      value={formData.renderMode}
                      onValueChange={(value) =>
                        setFormData({ ...formData, renderMode: value })
                      }
                    >
                      <SelectTrigger id="renderMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veo3_fast">Veo3 Fast - Quick turnaround</SelectItem>
                        <SelectItem value="veo3">Veo3 - Maximum quality</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Assets & Special Requirements Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Assets & Requirements</h3>
                  
                  <div className="space-y-2">
                    <Label>Image Reference (Optional)</Label>
                    <p className="text-sm text-muted-foreground">
                      Select one photo from available images to use as a reference
                    </p>
                    <SinglePhotoSelector 
                      selectedPhotoId={selectedPhotoId}
                      onPhotoSelect={setSelectedPhotoId}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialRequest">Special Requests</Label>
                    <Textarea
                      id="specialRequest"
                      placeholder="Any custom requirements, effects, branding guidelines, or special notes..."
                      value={formData.specialRequest}
                      onChange={(e) =>
                        setFormData({ ...formData, specialRequest: e.target.value })
                      }
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Submitting..." : "Submit Request"}
                  </Button>
                  <SaveTemplateDialog formData={formData} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default NewRequest;
