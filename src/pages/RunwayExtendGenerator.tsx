import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunwayExtendForm } from "@/components/runway-extend/RunwayExtendForm";
import { RunwayExtendList } from "@/components/runway-extend/RunwayExtendList";
import { Film, Plus, List } from "lucide-react";

const RunwayExtendGenerator = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("create");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleGenerationStarted = () => {
    setActiveTab("videos");
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Film className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">Runway Extend</h1>
            </div>
            <p className="text-muted-foreground">
              Create multi-scene videos with perfect avatar consistency using frame-to-frame extension
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                My Videos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <RunwayExtendForm onGenerationStarted={handleGenerationStarted} />
            </TabsContent>

            <TabsContent value="videos">
              <RunwayExtendList refreshTrigger={refreshTrigger} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RunwayExtendGenerator;
