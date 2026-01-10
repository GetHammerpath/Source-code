import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Clock, Play, Film } from "lucide-react";

interface Generation {
  id: string;
  avatar_name: string;
  industry: string;
  city: string;
  initial_status: string | null;
  initial_video_url: string | null;
  final_video_url: string | null;
  final_video_status: string | null;
  initial_error: string | null;
  variable_values: Record<string, string>;
}

interface SmartBulkProgressTrackerProps {
  batchId: string;
}

export const SmartBulkProgressTracker = ({ batchId }: SmartBulkProgressTrackerProps) => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchInfo, setBatchInfo] = useState<{
    name: string;
    status: string;
    total: number;
    completed: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`smart-batch-progress-${batchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kie_video_generations",
        },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bulk_video_batches",
          filter: `id=eq.${batchId}`,
        },
        () => {
          fetchBatchInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId]);

  const fetchBatchInfo = async () => {
    const { data } = await supabase
      .from("bulk_video_batches")
      .select("name, status, total_variations, completed_variations, failed_variations")
      .eq("id", batchId)
      .single();

    if (data) {
      setBatchInfo({
        name: data.name,
        status: data.status,
        total: data.total_variations,
        completed: data.completed_variations,
        failed: data.failed_variations,
      });
    }
  };

  const fetchData = async () => {
    await fetchBatchInfo();

    // Fetch generations linked to this batch
    const { data: batchGenerations } = await supabase
      .from("bulk_batch_generations")
      .select("generation_id, variable_values")
      .eq("batch_id", batchId)
      .order("variation_index", { ascending: true });

    if (!batchGenerations || batchGenerations.length === 0) {
      setLoading(false);
      return;
    }

    const generationIds = batchGenerations.map((bg) => bg.generation_id);

    const { data: generationsData } = await supabase
      .from("kie_video_generations")
      .select(
        "id, avatar_name, industry, city, initial_status, initial_video_url, final_video_url, final_video_status, initial_error"
      )
      .in("id", generationIds);

    if (generationsData) {
      // Merge variable_values into generations
      const merged = generationsData.map((gen) => {
        const batchGen = batchGenerations.find((bg) => bg.generation_id === gen.id);
        return {
          ...gen,
          variable_values: (batchGen?.variable_values as Record<string, string>) || {},
        };
      });
      setGenerations(merged);
    }

    setLoading(false);
  };

  const getStatusIcon = (gen: Generation) => {
    if (gen.final_video_url || gen.final_video_status === "completed") {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (gen.initial_error || gen.initial_status === "failed") {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (gen.initial_status === "processing" || gen.initial_video_url) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = (gen: Generation) => {
    if (gen.final_video_url || gen.final_video_status === "completed") {
      return "Completed";
    }
    if (gen.initial_error || gen.initial_status === "failed") {
      return "Failed";
    }
    if (gen.initial_status === "processing" || gen.initial_video_url) {
      return "Processing";
    }
    return "Pending";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = batchInfo
    ? Math.round(((batchInfo.completed + batchInfo.failed) / batchInfo.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Batch Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{batchInfo?.name || "Batch"}</CardTitle>
            <Badge
              className={
                batchInfo?.status === "completed"
                  ? "bg-green-500"
                  : batchInfo?.status === "processing"
                  ? "bg-blue-500"
                  : batchInfo?.status === "failed"
                  ? "bg-destructive"
                  : ""
              }
            >
              {batchInfo?.status || "Unknown"}
            </Badge>
          </div>
          <CardDescription>
            {batchInfo?.completed}/{batchInfo?.total} completed
            {batchInfo?.failed ? ` • ${batchInfo.failed} failed` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{progress}% complete</p>
        </CardContent>
      </Card>

      {/* Generation List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Video Generations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {generations.map((gen, index) => (
                <div key={gen.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{gen.avatar_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(gen.variable_values)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" • ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(gen)}
                      <span className="text-sm">{getStatusText(gen)}</span>
                    </div>
                  </div>

                  {/* Video Preview */}
                  {gen.final_video_url && (
                    <div className="mt-3">
                      <video
                        src={gen.final_video_url}
                        controls
                        className="w-full max-w-md rounded-lg"
                      />
                    </div>
                  )}

                  {/* Error Message */}
                  {gen.initial_error && (
                    <p className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {gen.initial_error}
                    </p>
                  )}
                </div>
              ))}

              {generations.length === 0 && (
                <div className="p-8 text-center">
                  <Film className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    No generations yet. Starting soon...
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
