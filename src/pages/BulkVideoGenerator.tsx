import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, List } from "lucide-react";
import BulkVideoForm from "@/components/bulk-video/BulkVideoForm";
import BulkBatchList from "@/components/bulk-video/BulkBatchList";
import BulkProgressTracker from "@/components/bulk-video/BulkProgressTracker";

const BulkVideoGenerator = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

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

  const handleBatchCreated = (batchId: string) => {
    setSelectedBatchId(batchId);
    setActiveTab("batches");
  };

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId);
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Bulk Video Generator
              </h1>
              <p className="text-muted-foreground">
                Create multiple video variations from a single base configuration
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

            <TabsContent value="create" className="mt-6">
              <BulkVideoForm userId={userId} onBatchCreated={handleBatchCreated} />
            </TabsContent>

            <TabsContent value="batches" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4">All Batches</h2>
                  <BulkBatchList
                    userId={userId}
                    onSelectBatch={handleSelectBatch}
                  />
                </div>
                {selectedBatchId && (
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Batch Details</h2>
                    <BulkProgressTracker batchId={selectedBatchId} />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default BulkVideoGenerator;
