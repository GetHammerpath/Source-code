import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Video, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Sora2LatestForm from "@/components/sora2-latest/Sora2LatestForm";
import Sora2LatestList from "@/components/sora2-latest/Sora2LatestList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Sora2LatestGenerator = () => {
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
        description: "Please log in to access the Sora 2 Latest generator.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    setUserId(user.id);
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 rounded-lg">
                <Zap className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Sora 2 Latest</h1>
                <p className="text-muted-foreground">
                  Multi-scene video generation with sora-2-pro-image-to-video
                </p>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20">
              <Sparkles className="h-5 w-5 text-violet-500 mb-2" />
              <h3 className="font-semibold">Per-Scene Control</h3>
              <p className="text-sm text-muted-foreground">Each scene is 10/15/25 seconds with individual prompts</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-500/5 border border-fuchsia-500/20">
              <Video className="h-5 w-5 text-fuchsia-500 mb-2" />
              <h3 className="font-semibold">Auto-Stitching</h3>
              <p className="text-sm text-muted-foreground">All scenes are automatically combined into one video</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/20">
              <Zap className="h-5 w-5 text-pink-500 mb-2" />
              <h3 className="font-semibold">Longer Videos</h3>
              <p className="text-sm text-muted-foreground">Create videos up to several minutes long</p>
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
              <Sora2LatestForm userId={userId} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Sora2LatestList userId={userId} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Sora2LatestGenerator;
