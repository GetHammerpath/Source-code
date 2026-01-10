import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Calendar, Film } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Batch {
  id: string;
  name: string;
  status: string;
  total_variations: number;
  completed_variations: number;
  failed_variations: number;
  created_at: string;
}

interface SmartBulkBatchListProps {
  userId: string;
  onSelectBatch: (batchId: string) => void;
  selectedBatchId: string | null;
}

export const SmartBulkBatchList = ({
  userId,
  onSelectBatch,
  selectedBatchId,
}: SmartBulkBatchListProps) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("smart-bulk-batches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bulk_video_batches",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchBatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchBatches = async () => {
    const { data, error } = await supabase
      .from("bulk_video_batches")
      .select("id, name, status, total_variations, completed_variations, failed_variations, created_at, generation_mode")
      .eq("user_id", userId)
      .eq("generation_mode", "smart_selection")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching batches:", error);
    } else {
      setBatches((data || []) as unknown as Batch[]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "processing":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No smart bulk batches yet.</p>
          <p className="text-sm text-muted-foreground">
            Create your first batch in the Create tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {batches.map((batch) => {
        const progress =
          batch.total_variations > 0
            ? Math.round(
                ((batch.completed_variations + batch.failed_variations) /
                  batch.total_variations) *
                  100
              )
            : 0;

        return (
          <Card
            key={batch.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedBatchId === batch.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => onSelectBatch(batch.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{batch.name}</CardTitle>
                {getStatusBadge(batch.status)}
              </div>
              <CardDescription className="flex items-center gap-2 text-xs">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(new Date(batch.created_at), {
                  addSuffix: true,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span>
                    {batch.completed_variations}/{batch.total_variations} videos
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {batch.failed_variations > 0 && (
                  <p className="text-xs text-destructive">
                    {batch.failed_variations} failed
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBatch(batch.id);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
