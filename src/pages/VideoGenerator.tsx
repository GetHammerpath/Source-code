import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VideoGeneratorForm from "@/components/video-generator/VideoGeneratorForm";
import VideoGenerationsList from "@/components/video-generator/VideoGenerationsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VideoGenerator = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDuplicate = (generation: any) => {
    setDuplicateData(generation);
    setActiveTab("create");
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access the video generator.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    setUserId(user.id);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Dashboard
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Studio</h1>
                <p className="text-muted-foreground">
                  Create stunning marketing videos from a single image
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Create New
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                My Videos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              {userId && (
                <VideoGeneratorForm 
                  userId={userId} 
                  duplicateData={duplicateData}
                  onDuplicateConsumed={() => setDuplicateData(null)}
                />
              )}
            </TabsContent>

            <TabsContent value="history">
              {userId && <VideoGenerationsList userId={userId} onDuplicate={handleDuplicate} />}
            </TabsContent>
          </Tabs>
    </div>
  );
};

export default VideoGenerator;
