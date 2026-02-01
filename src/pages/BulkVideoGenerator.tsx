import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import BulkBatchList from "@/components/bulk-video/BulkBatchList";

const BulkVideoGenerator = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

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

  const handleSelectBatch = (batchId: string) => {
    navigate(`/batch/${batchId}`);
  };

  if (!userId) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Batches</h1>
            <p className="text-muted-foreground">View and manage your bulk video batches</p>
          </div>
        </div>
        <Button onClick={() => navigate("/bulk")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Batch
        </Button>
      </div>

      <BulkBatchList userId={userId} onSelectBatch={handleSelectBatch} />
    </div>
  );
};

export default BulkVideoGenerator;
