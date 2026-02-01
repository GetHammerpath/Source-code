import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { launchBatch } from "@/lib/api/bulk";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Plus, List, Image as ImageIcon, FileText } from "lucide-react";
import { BatchWorkspace } from "@/components/bulk/BatchWorkspace";
import type { BatchRow } from "@/components/bulk/SmartTable";
import BulkBatchList from "@/components/bulk-video/BulkBatchList";
import SinglePhotoSelector from "@/components/forms/SinglePhotoSelector";

const BulkVideoGenerator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const [baseConfig, setBaseConfig] = useState({
    name: "",
    imageUrl: "" as string | null,
    industry: "",
    city: "",
    storyIdea: "",
    model: "veo3_fast",
    aspectRatio: "16:9",
    numberOfScenes: 3,
    generationMode: "image" as "image" | "text",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  const handlePhotoSelect = async (photoId: string | null) => {
    setSelectedPhotoId(photoId);
    if (photoId) {
      const { data } = await supabase
        .from("jobsite_photos")
        .select("file_url")
        .eq("id", photoId)
        .single();
      setBaseConfig((c) => ({ ...c, imageUrl: data?.file_url || null }));
    } else {
      setBaseConfig((c) => ({ ...c, imageUrl: null }));
    }
  };

  const handleLaunch = async (rows: BatchRow[], isTestRun: boolean) => {
    if (!userId) return;
    if (!baseConfig.name.trim()) {
      toast({ title: "Batch name required", variant: "destructive" });
      return;
    }
    if (!baseConfig.industry.trim() || !baseConfig.city.trim()) {
      toast({ title: "Industry and city required", variant: "destructive" });
      return;
    }
    if (baseConfig.generationMode === "image" && !baseConfig.imageUrl) {
      toast({ title: "Select an image for Image Reference mode", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await launchBatch(userId, rows, {
        name: baseConfig.name,
        imageUrl: baseConfig.imageUrl,
        industry: baseConfig.industry,
        city: baseConfig.city,
        storyIdea: baseConfig.storyIdea,
        model: baseConfig.model,
        aspectRatio: baseConfig.aspectRatio,
        numberOfScenes: baseConfig.numberOfScenes,
        generationType: baseConfig.generationMode === "image" ? "REFERENCE_2_VIDEO" : "TEXT_2_VIDEO",
      }, isTestRun);

      toast({
        title: isTestRun ? "Test run started!" : "Bulk generation started!",
        description: isTestRun
          ? "Generating first 3 videos for review"
          : `Creating ${rows.length} video variations`,
      });

      navigate(`/batch/${result.batch_id}`);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Failed to start bulk generation",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectBatch = (batchId: string) => {
    navigate(`/batch/${batchId}`);
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bulk Video Generator</h1>
          <p className="text-muted-foreground">
            Smart Table: Upload CSV, AI Campaign, or Spinner. Mix avatars and scripts.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Batch
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            My Batches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6 space-y-6 pb-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Base Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batch Name</Label>
                  <Input
                    placeholder="e.g., Q1 Campaign"
                    value={baseConfig.name}
                    onChange={(e) => setBaseConfig((c) => ({ ...c, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <RadioGroup
                    value={baseConfig.generationMode}
                    onValueChange={(v) => {
                      setBaseConfig((c) => ({
                        ...c,
                        generationMode: v as "image" | "text",
                        imageUrl: v === "text" ? null : c.imageUrl,
                      }));
                      if (v === "text") setSelectedPhotoId(null);
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="image" id="mode-img" />
                      <Label htmlFor="mode-img" className="cursor-pointer flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" /> Image
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="text" id="mode-txt" />
                      <Label htmlFor="mode-txt" className="cursor-pointer flex items-center gap-1">
                        <FileText className="h-4 w-4" /> Text Only
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              {baseConfig.generationMode === "image" && (
                <div className="space-y-2">
                  <Label>Business Image</Label>
                  <SinglePhotoSelector
                    selectedPhotoId={selectedPhotoId}
                    onPhotoSelect={handlePhotoSelect}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    placeholder="e.g., Roofing"
                    value={baseConfig.industry}
                    onChange={(e) => setBaseConfig((c) => ({ ...c, industry: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    placeholder="e.g., Austin, TX"
                    value={baseConfig.city}
                    onChange={(e) => setBaseConfig((c) => ({ ...c, city: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Story Idea (Optional)</Label>
                <Input
                  placeholder="Default story concept"
                  value={baseConfig.storyIdea}
                  onChange={(e) => setBaseConfig((c) => ({ ...c, storyIdea: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={baseConfig.model}
                    onValueChange={(v) => setBaseConfig((c) => ({ ...c, model: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veo3_fast">Veo3 Fast</SelectItem>
                      <SelectItem value="veo3">Veo3 Quality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <Select
                    value={baseConfig.aspectRatio}
                    onValueChange={(v) => setBaseConfig((c) => ({ ...c, aspectRatio: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="9:16">9:16</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scenes</Label>
                  <Select
                    value={baseConfig.numberOfScenes.toString()}
                    onValueChange={(v) => setBaseConfig((c) => ({ ...c, numberOfScenes: parseInt(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <BatchWorkspace
            userId={userId}
            baseConfig={{
              name: baseConfig.name,
              imageUrl: baseConfig.imageUrl,
              industry: baseConfig.industry,
              city: baseConfig.city,
              storyIdea: baseConfig.storyIdea,
              model: baseConfig.model,
              aspectRatio: baseConfig.aspectRatio,
              numberOfScenes: baseConfig.numberOfScenes,
              generationType: baseConfig.generationMode === "image" ? "REFERENCE_2_VIDEO" : "TEXT_2_VIDEO",
            }}
            onLaunch={handleLaunch}
            isSubmitting={isSubmitting}
          />
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
          <h2 className="text-lg font-semibold mb-4">All Batches</h2>
          <BulkBatchList userId={userId} onSelectBatch={handleSelectBatch} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkVideoGenerator;
