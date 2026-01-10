import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, Download, Film, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Sora2LatestListProps {
  userId: string;
}

const Sora2LatestList = ({ userId }: Sora2LatestListProps) => {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    fetchGenerations();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('sora2_generations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kie_video_generations',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchGenerations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('kie_video_generations')
        .select('*')
        .eq('user_id', userId)
        .eq('sora_model', 'sora-2-pro-image-to-video')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (generationId: string) => {
    setRetrying(generationId);
    try {
      const { data, error } = await supabase.functions.invoke('sora2-extend-next', {
        body: { generation_id: generationId, retry: true }
      });
      
      if (error) throw error;
      
      toast.success(data.message || 'Retry started successfully!');
      await fetchGenerations();
    } catch (error: any) {
      console.error('Error retrying generation:', error);
      toast.error(error.message || 'Failed to retry generation');
    } finally {
      setRetrying(null);
    }
  };

  const getStatusBadge = (status: string, errorType?: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />Completed</Badge>;
      case 'generating':
        return <Badge className="bg-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating</Badge>;
      case 'failed':
        if (errorType === 'CREDIT_EXHAUSTED') {
          return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Credits Exhausted</Badge>;
        }
        if (errorType === 'RATE_LIMITED') {
          return <Badge variant="destructive"><Clock className="mr-1 h-3 w-3" />Rate Limited</Badge>;
        }
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No Sora 2 Latest videos yet. Create your first one!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {generations.map((gen) => (
        <Card key={gen.id}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  {gen.industry} - {gen.avatar_name}
                  <Badge variant="secondary" className="ml-2">
                    {gen.number_of_scenes} Scenes
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground">{gen.city}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {formatDistanceToNow(new Date(gen.created_at), { addSuffix: true })}
                </p>
                
                {/* Progress bar */}
                <div className="mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      Scene {gen.current_scene || 1} of {gen.number_of_scenes}
                    </span>
                    {gen.initial_status === 'generating' || gen.extended_status === 'generating' ? (
                      <Badge className="bg-blue-500">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Generating
                      </Badge>
                    ) : null}
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${((gen.video_segments?.length || 0) / gen.number_of_scenes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Video Segments */}
              <div className="space-y-3 mb-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Video Segments ({gen.video_segments?.length || 0} / {gen.number_of_scenes})
                </h4>
                
                {gen.video_segments && gen.video_segments.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {gen.video_segments.map((segment: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">
                            Scene {segment.scene || index + 1}
                          </span>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {segment.type}
                          </Badge>
                        </div>
                        <video
                          src={segment.url}
                          controls
                          className="w-full rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No segments yet</p>
                )}
              </div>

              {/* Final Video */}
              {gen.final_video_url && (
                <div className="border-2 border-primary rounded-lg p-4 mt-4 bg-primary/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Final Video
                      <Badge variant="outline">
                        {gen.number_of_scenes * (gen.duration || 10)}s total
                      </Badge>
                    </h4>
                    {getStatusBadge(gen.final_video_status)}
                  </div>
                  
                  <video
                    src={gen.final_video_url}
                    controls
                    className="w-full rounded-lg mb-3"
                  />
                  
                  <Button variant="outline" className="w-full" asChild>
                    <a href={gen.final_video_url} download={`sora2-video-${gen.id}.mp4`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Final Video
                    </a>
                  </Button>
                </div>
              )}

              {/* Error Details */}
              {(gen.initial_error || gen.extended_error) && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Generation Error
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {gen.initial_error || gen.extended_error}
                  </p>
                </div>
              )}

              {/* Retry Button */}
              {(gen.initial_status === 'failed' || gen.extended_status === 'failed') && (
                <Button
                  onClick={() => handleRetry(gen.id)}
                  variant="outline"
                  size="sm"
                  disabled={retrying === gen.id}
                  className="mt-2"
                >
                  {retrying === gen.id ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Retry Failed Scene
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Sora2LatestList;
