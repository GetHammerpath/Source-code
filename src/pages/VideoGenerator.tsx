import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VideoGeneratorForm from "@/components/video-generator/VideoGeneratorForm";
import VideoGenerationsList from "@/components/video-generator/VideoGenerationsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VideoGenerator = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">AI Video Generator</h1>
                <p className="text-muted-foreground">
                  Powered by Kie.ai - Create personalized business videos from images
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Create New
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                My Videos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6">
              {userId && <VideoGeneratorForm userId={userId} />}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              {userId && <VideoGenerationsList userId={userId} />}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default VideoGenerator;
