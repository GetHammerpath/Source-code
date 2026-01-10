import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { Eye, Trash2, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  total_variations: number;
  completed_variations: number;
  failed_variations: number;
  status: string;
  created_at: string;
  base_industry: string;
}

interface BulkBatchListProps {
  userId: string;
  onSelectBatch: (batchId: string) => void;
}

const BulkBatchList = ({ userId, onSelectBatch }: BulkBatchListProps) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await supabase
        .from("bulk_video_batches")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (data) {
        setBatches(data);
      }
      setLoading(false);
    };

    fetchBatches();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("bulk-batches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bulk_video_batches",
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

  const deleteBatch = async (batchId: string) => {
    const { error } = await supabase
      .from("bulk_video_batches")
      .delete()
      .eq("id", batchId);

    if (!error) {
      setBatches((prev) => prev.filter((b) => b.id !== batchId));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "generating":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "generating":
        return <Badge>Generating</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">No bulk batches yet</p>
        <p className="text-sm">Create your first bulk video generation above.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
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
            <Card key={batch.id} className="border-border">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(batch.status)}
                    <div>
                      <CardTitle className="text-base">{batch.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {batch.base_industry} •{" "}
                        {formatDistanceToNow(new Date(batch.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(batch.status)}
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {batch.completed_variations + batch.failed_variations} /{" "}
                      {batch.total_variations}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-success" />
                      {batch.completed_variations}
                    </span>
                    {batch.failed_variations > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {batch.failed_variations}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectBatch(batch.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBatch(batch.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default BulkBatchList;
