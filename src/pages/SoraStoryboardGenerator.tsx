import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Music, Film, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SoraStoryboardForm from "@/components/sora-storyboard/SoraStoryboardForm";
import SoraStoryboardList from "@/components/sora-storyboard/SoraStoryboardList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SoraStoryboardGenerator = () => {
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
        description: "Please log in to access Sora 2 Pro Storyboard.",
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
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg">
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Sora 2 Pro Storyboard Generator
                </h1>
                <p className="text-muted-foreground">
                  Powered by OpenAI Sora 2 - Hollywood-quality cinematic videos with synchronized audio
                </p>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-amber-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">Synchronized Audio</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Native audio generation with natural dialogue and ambient sounds
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-amber-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">Cinematic Quality</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  1080p HD with realistic physics, motion, and lighting
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-amber-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">Extended Duration</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Generate 10-15 second scenes (up to 45s total for 3 scenes)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Create Storyboard
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                My Sora Videos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6">
              <SoraStoryboardForm userId={userId} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <SoraStoryboardList userId={userId} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SoraStoryboardGenerator;
