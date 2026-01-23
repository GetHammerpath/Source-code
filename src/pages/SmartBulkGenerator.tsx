import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Variable, Eye, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SmartBulkForm, SmartBulkFormData } from "@/components/smart-bulk/SmartBulkForm";
import { SmartVariableManager, Variable as VariableType, PREDEFINED_VARIABLES } from "@/components/smart-bulk/SmartVariableManager";
import { EditableCombinationsTable, EditableCombination } from "@/components/smart-bulk/EditableCombinationsTable";
import { SmartBulkBatchList } from "@/components/smart-bulk/SmartBulkBatchList";
import { SmartBulkProgressTracker } from "@/components/smart-bulk/SmartBulkProgressTracker";

// Cross-browser compatible UUID generator
const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Calculate all possible combinations
const calculateAllCombinations = (
  variables: VariableType[]
): Array<{ [key: string]: string }> => {
  const variablesWithValues = variables.filter((v) => v.values.length > 0);
  if (variablesWithValues.length === 0) return [];

  const result: Array<{ [key: string]: string }> = [];

  const generate = (
    index: number,
    current: { [key: string]: string }
  ) => {
    if (index === variablesWithValues.length) {
      result.push({ ...current });
      return;
    }

    const variable = variablesWithValues[index];
    for (const value of variable.values) {
      current[variable.name] = value;
      generate(index + 1, current);
    }
  };

  generate(0, {});
  return result;
};

// Select random combinations using Fisher-Yates shuffle
const selectRandomCombinations = (
  allCombinations: Array<{ [key: string]: string }>,
  count: number
): EditableCombination[] => {
  const shuffled = [...allCombinations];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length)).map((combo) => ({
    id: generateId(),
    values: combo,
  }));
};

const SmartBulkGenerator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<SmartBulkFormData>>({});
  const [variables, setVariables] = useState<VariableType[]>([]);
  const [videoCount, setVideoCount] = useState(10);
  const [combinations, setCombinations] = useState<EditableCombination[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-tabs for create flow
  const [createSubTab, setCreateSubTab] = useState("config");

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  const handleFormUpdate = useCallback((data: SmartBulkFormData) => {
    setFormData(data);
  }, []);

  const totalPossibleCombinations = calculateAllCombinations(variables).length;

  const handleGenerateCombinations = () => {
    const allCombinations = calculateAllCombinations(variables);
    const selected = selectRandomCombinations(allCombinations, videoCount);
    setCombinations(selected);
    setCreateSubTab("review");

    toast({
      title: "Combinations Generated",
      description: `${selected.length} random combinations created. Review and edit them below.`,
    });
  };

  const handleAutoGenerateCombinations = (selectedVariableNames: string[]) => {
    // Create variables array from PREDEFINED_VARIABLES with all their suggestions as values
    const autoVariables: VariableType[] = selectedVariableNames.map((name) => {
      const predefined = PREDEFINED_VARIABLES.find((v) => v.name === name);
      return {
        id: generateId(),
        name: predefined!.name,
        label: predefined!.label,
        values: predefined!.suggestions,
      };
    });

    // Update variables state
    setVariables(autoVariables);

    // Calculate all combinations and select random ones
    const allCombinations = calculateAllCombinations(autoVariables);
    const selected = selectRandomCombinations(allCombinations, videoCount);
    setCombinations(selected);

    // Move to review tab
    setCreateSubTab("review");

    toast({
      title: "Auto Generated",
      description: `${selected.length} random combinations created from ${allCombinations.length} possibilities.`,
    });
  };

  const handleRegenerate = () => {
    const allCombinations = calculateAllCombinations(variables);
    const selected = selectRandomCombinations(allCombinations, videoCount);
    setCombinations(selected);
  };

  const handleSubmit = async () => {
    if (!userId) return;

    if (!formData.batchName || !formData.industry || !formData.city) {
      toast({
        title: "Missing Information",
        description: "Please fill in batch name, industry, and city.",
        variant: "destructive",
      });
      return;
    }

    if (combinations.length === 0) {
      toast({
        title: "No Combinations",
        description: "Please generate combinations first.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine generation type
      const generationType = formData.imageUrl ? "REFERENCE_2_VIDEO" : "TEXT_2_VIDEO";

      // Create batch record
      const { data: batch, error: batchError } = await supabase
        .from("bulk_video_batches")
        .insert([{
          user_id: userId,
          name: formData.batchName,
          base_image_url: formData.imageUrl || null,
          base_industry: formData.industry!,
          base_city: formData.city!,
          base_story_idea: formData.storyIdea || null,
          model: formData.model || "veo3_fast",
          aspect_ratio: formData.aspectRatio || "16:9",
          number_of_scenes: formData.numberOfScenes || 3,
          variables: JSON.parse(JSON.stringify(variables)),
          total_variations: combinations.length,
          status: "processing",
          generation_type: generationType,
          generation_mode: "smart_selection",
        }])
        .select()
        .single();

      if (batchError) throw batchError;

      // Convert combinations for the edge function
      const combinationsForApi = combinations.map((combo) => combo.values);

      // Call the edge function
      const { error: fnError } = await supabase.functions.invoke(
        "smart-bulk-generate",
        {
          body: {
            batch_id: batch.id,
            combinations: combinationsForApi,
            base_config: {
              image_url: formData.imageUrl || null,
              generation_type: generationType,
              industry: formData.industry,
              city: formData.city,
              story_idea: formData.storyIdea || null,
              model: formData.model || "veo3_fast",
              aspect_ratio: formData.aspectRatio || "16:9",
              number_of_scenes: formData.numberOfScenes || 3,
            },
          },
        }
      );

      if (fnError) throw fnError;

      toast({
        title: "Batch Started",
        description: `${combinations.length} videos are being generated.`,
      });

      // Reset form and show batches
      setFormData({});
      setVariables([]);
      setCombinations([]);
      setVideoCount(10);
      setCreateSubTab("config");
      setSelectedBatchId(batch.id);
      setActiveTab("batches");
    } catch (error) {
      console.error("Error starting batch:", error);
      toast({
        title: "Error",
        description: "Failed to start batch generation.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId);
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-8 px-4 md:px-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Smart Bulk Video</h1>
              <p className="text-muted-foreground">
                Generate multiple videos with random variable combinations
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="create">Create Batch</TabsTrigger>
              <TabsTrigger value="batches">My Batches</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <Tabs value={createSubTab} onValueChange={setCreateSubTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="config" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Config
                  </TabsTrigger>
                  <TabsTrigger value="variables" className="gap-2">
                    <Variable className="h-4 w-4" />
                    Variables
                  </TabsTrigger>
                  <TabsTrigger
                    value="review"
                    className="gap-2"
                    disabled={combinations.length === 0}
                  >
                    <Eye className="h-4 w-4" />
                    Review ({combinations.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="config">
                  <SmartBulkForm
                    onUpdate={handleFormUpdate}
                    initialData={formData}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => setCreateSubTab("variables")}>
                      Continue to Variables
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="variables">
                  <SmartVariableManager
                    variables={variables}
                    onChange={setVariables}
                    videoCount={videoCount}
                    onVideoCountChange={setVideoCount}
                    onGenerateCombinations={handleGenerateCombinations}
                    onAutoGenerateCombinations={handleAutoGenerateCombinations}
                    totalPossibleCombinations={totalPossibleCombinations}
                  />
                </TabsContent>

                <TabsContent value="review">
                  <EditableCombinationsTable
                    combinations={combinations}
                    variables={variables}
                    baseConfig={{
                      industry: formData.industry || "",
                      city: formData.city || "",
                      storyIdea: formData.storyIdea,
                    }}
                    onChange={setCombinations}
                    onRegenerate={handleRegenerate}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="batches">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <SmartBulkBatchList
                    userId={userId}
                    onSelectBatch={handleSelectBatch}
                    selectedBatchId={selectedBatchId}
                  />
                </div>
                <div className="lg:col-span-2">
                  {selectedBatchId ? (
                    <SmartBulkProgressTracker batchId={selectedBatchId} />
                  ) : (
                    <div className="flex items-center justify-center h-[400px] border rounded-lg border-dashed">
                      <div className="text-center">
                        <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Select a batch to view progress
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
    </div>
  );
};

export default SmartBulkGenerator;
