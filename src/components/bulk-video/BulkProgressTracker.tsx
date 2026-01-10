import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Loader2, Clock, Video } from "lucide-react";

interface BatchGeneration {
  id: string;
  generation_id: string;
  variable_values: Record<string, string>;
  variation_index: number;
  generation?: {
    initial_status: string;
    initial_video_url: string | null;
    final_video_url: string | null;
    final_video_status: string;
    initial_error: string | null;
  };
}

interface BulkProgressTrackerProps {
  batchId: string;
  onComplete?: () => void;
}

const BulkProgressTracker = ({ batchId, onComplete }: BulkProgressTrackerProps) => {
  const [batch, setBatch] = useState<{
    name: string;
    total_variations: number;
    completed_variations: number;
    failed_variations: number;
    status: string;
  } | null>(null);
  const [generations, setGenerations] = useState<BatchGeneration[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch batch info
      const { data: batchData } = await supabase
        .from("bulk_video_batches")
        .select("*")
        .eq("id", batchId)
        .single();

      if (batchData) {
        setBatch(batchData);
      }

      // Fetch generations
      const { data: genData } = await supabase
        .from("bulk_batch_generations")
        .select(`
          *,
          generation:kie_video_generations(
            initial_status,
            initial_video_url,
            final_video_url,
            final_video_status,
            initial_error
          )
        `)
        .eq("batch_id", batchId)
        .order("variation_index", { ascending: true });

      if (genData) {
        setGenerations(genData as BatchGeneration[]);
      }
    };

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`batch-${batchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bulk_video_batches",
          filter: `id=eq.${batchId}`,
        },
        (payload) => {
          if (payload.new) {
            setBatch(payload.new as typeof batch);
            if ((payload.new as any).status === "completed") {
              onComplete?.();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kie_video_generations",
        },
        () => {
          // Refresh generations on any update
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId, onComplete]);

  if (!batch) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const progressPercent = batch.total_variations > 0
    ? Math.round(((batch.completed_variations + batch.failed_variations) / batch.total_variations) * 100)
    : 0;

  const getStatusIcon = (generation: BatchGeneration) => {
    const status = generation.generation?.final_video_status || generation.generation?.initial_status;
    
    if (status === "completed") {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    if (status === "failed") {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (status === "processing" || status === "pending") {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-success">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "generating":
        return <Badge variant="default">Generating</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{batch.name}</CardTitle>
          {getStatusBadge(batch.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>
              {batch.completed_variations + batch.failed_variations} / {batch.total_variations}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-success" />
              {batch.completed_variations} completed
            </span>
            {batch.failed_variations > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                {batch.failed_variations} failed
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(gen)}
                  <div>
                    <p className="text-sm font-medium">
                      Variation #{gen.variation_index + 1}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Object.entries(gen.variable_values)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </p>
                  </div>
                </div>
                {gen.generation?.initial_video_url && (
                  <a
                    href={gen.generation.final_video_url || gen.generation.initial_video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    <Video className="h-4 w-4" />
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BulkProgressTracker;
