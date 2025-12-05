import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, Plus, Download, Film, Video, Scissors, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface VideoGenerationsListProps {
  userId: string;
}

const VideoGenerationsList = ({ userId }: VideoGenerationsListProps) => {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState<string | null>(null);
  const [stitching, setStitching] = useState<string | null>(null);
  const [trimSeconds, setTrimSeconds] = useState<number>(1);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    fetchGenerations();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('kie_generations_changes')
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

  // Poll for status updates on generating videos (not stitching - Cloudinary is synchronous)
  useEffect(() => {
    const pollStatus = async () => {
      const generatingItems = generations.filter(
        gen => gen.initial_status === 'generating' || 
               gen.extended_status === 'generating'
      );

      for (const gen of generatingItems) {
        try {
          // Check video generation status
          if (gen.initial_status === 'generating' || gen.extended_status === 'generating') {
            await supabase.functions.invoke('kie-check-status', {
              body: { generation_id: gen.id }
            });
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }
    };

    if (generations.some(gen => 
      gen.initial_status === 'generating' || 
      gen.extended_status === 'generating'
    )) {
      const interval = setInterval(pollStatus, 15000); // Poll every 15 seconds
      return () => clearInterval(interval);
    }
  }, [generations]);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('kie_video_generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtendNext = async (generationId: string) => {
    setExtending(generationId);
    try {
      const { data, error } = await supabase.functions.invoke('kie-extend-next', {
        body: { generation_id: generationId }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to extend video');
      }

      toast.success("Extension Started", {
        description: "Your video is being extended. This will take a few minutes.",
      });
    } catch (error) {
      console.error('Error extending video:', error);
      toast.error("Extension Failed", {
        description: error instanceof Error ? error.message : "Failed to extend video",
      });
    } finally {
      setExtending(null);
    }
  };

  const handleStitchVideos = async (generationId: string) => {
    setStitching(generationId);
    try {
      const { data, error } = await supabase.functions.invoke('cloudinary-stitch-videos', {
        body: { generation_id: generationId, trim: false }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to stitch videos');
      }

      toast.success("Videos Combined!", {
        description: "Your videos have been successfully merged.",
      });
      
      // Refresh to show final video
      await fetchGenerations();
    } catch (error) {
      console.error('Error stitching videos:', error);
      toast.error("Stitching Failed", {
        description: error instanceof Error ? error.message : "Failed to combine videos",
      });
    } finally {
      setStitching(null);
    }
  };

  const handleStitchWithTrim = async (generationId: string) => {
    setStitching(generationId);
    try {
      const { data, error } = await supabase.functions.invoke('cloudinary-stitch-videos', {
        body: { generation_id: generationId, trim: true, trim_seconds: trimSeconds }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to stitch videos');
      }

      toast.success("Videos Combined!", {
        description: "Your videos have been successfully merged with smooth transitions.",
      });
      
      // Refresh to show final video
      await fetchGenerations();
    } catch (error) {
      console.error('Error stitching with trim:', error);
      toast.error("Stitching Failed", {
        description: error instanceof Error ? error.message : "Failed to combine videos",
      });
    } finally {
      setStitching(null);
    }
  };

  const handleRetry = async (generationId: string) => {
    setRetrying(generationId);
    try {
      const { data, error } = await supabase.functions.invoke('kie-retry-generation', {
        body: { generation_id: generationId }
      });
      
      if (error) throw error;
      
      toast.success(data.message || 'Retry started successfully!');
      await fetchGenerations(); // Refresh data
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
          <p className="text-muted-foreground">No video generations yet. Create your first one!</p>
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
                  {gen.is_multi_scene && (
                    <Badge variant="secondary" className="ml-2">
                      {gen.number_of_scenes} Scenes
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">{gen.city}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {formatDistanceToNow(new Date(gen.created_at), { addSuffix: true })}
                </p>
                {gen.is_multi_scene && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        Scene {gen.current_scene || 1} of {gen.number_of_scenes}
                      </span>
                      {gen.current_scene < gen.number_of_scenes && (
                        <Badge className="bg-blue-500">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Generating
                        </Badge>
                      )}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${((gen.current_scene || 1) / gen.number_of_scenes) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {/* Video Segments Timeline */}
              <div className="space-y-3 mb-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Video Segments ({gen.video_segments?.length || 0} parts)
                </h4>
                
                {gen.video_segments && gen.video_segments.length > 0 ? (
                  <div className="space-y-2">
                    {gen.video_segments.map((segment: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">
                            Part {index + 1} - {(segment.duration / 1000).toFixed(0)}s
                          </span>
                          <Badge variant="secondary" className="capitalize">
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

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap mb-4">
                {/* Extend Further Button */}
                {!gen.is_final && 
                 gen.extended_status === 'completed' && 
                 gen.video_segments?.length >= 2 && (
                  <Button
                    onClick={() => handleExtendNext(gen.id)}
                    variant="outline"
                    size="sm"
                    disabled={extending === gen.id}
                  >
                    {extending === gen.id ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Extending...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-3 w-3" />
                        Extend Further (+8s)
                      </>
                    )}
                  </Button>
                )}

                {/* Cloudinary Smooth Merge */}
                {gen.video_segments?.length >= 2 && (
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label htmlFor={`trim-${gen.id}`} className="text-sm font-medium mb-1 block">
                          Trim Duration (seconds)
                        </label>
                        <input
                          id={`trim-${gen.id}`}
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.5"
                          value={trimSeconds}
                          onChange={(e) => setTrimSeconds(parseFloat(e.target.value))}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Removes first X seconds from each segment for smoother transitions
                        </p>
                      </div>
                      <Button
                        onClick={() => handleStitchWithTrim(gen.id)}
                        variant="default"
                        size="sm"
                        disabled={stitching === gen.id}
                        className="self-end"
                      >
                        {stitching === gen.id ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Combining...
                          </>
                        ) : (
                          <>
                            <Scissors className="mr-2 h-3 w-3" />
                            Smooth Merge
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

              </div>

              {/* Final Stitched Video */}
              {gen.final_video_url && (
                <div className="border-2 border-primary rounded-lg p-4 mt-4 bg-primary/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Final Video
                      <Badge variant="outline">
                        {(gen.video_segments?.reduce((sum: number, seg: any) => sum + seg.duration, 0) / 1000 || 0).toFixed(0)}s total
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
                    <a href={gen.final_video_url} download={`video-${gen.id}.mp4`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Final Video
                    </a>
                  </Button>
                </div>
              )}

              {/* Error Details Section */}
              {gen.initial_error && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Generation Error
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {gen.initial_error}
                  </p>
                  {gen.metadata?.error_type === 'CREDIT_EXHAUSTED' && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                      <p className="text-xs font-semibold">💡 Solution:</p>
                      <p className="text-xs">Add more credits to your Kie.ai account to continue generating videos.</p>
                    </div>
                  )}
                </div>
              )}

              {gen.extended_error && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Extension Error
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {gen.extended_error}
                  </p>
                  {gen.metadata?.error_type === 'CREDIT_EXHAUSTED' && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                      <p className="text-xs font-semibold">💡 Solution:</p>
                      <p className="text-xs">Add more credits to your Kie.ai account to continue generating videos.</p>
                    </div>
                  )}
                </div>
              )}

              {gen.final_video_error && (
                <p className="text-sm text-destructive mt-2">
                  Final video error: {gen.final_video_error}
                </p>
              )}

              {/* Show Retry Button for Failed Generations */}
              {(gen.initial_status === 'failed' || gen.extended_status === 'failed') && (
                <Button
                  onClick={() => handleRetry(gen.id)}
                  disabled={retrying === gen.id}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {retrying === gen.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Failed {gen.initial_status === 'failed' ? 'Scene 1' : `Scene ${gen.current_scene}`}
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* AI Prompt & Script */}
            <details className="mt-4">
              <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                View AI Details
              </summary>
              <div className="mt-2 space-y-3">
                {gen.scene_prompts && gen.scene_prompts.length > 0 ? (
                  <div className="space-y-3">
                    {gen.scene_prompts.map((scene: any) => (
                      <div key={scene.scene_number} className="p-3 bg-muted rounded-lg">
                        <Badge className="mb-2">Scene {scene.scene_number}</Badge>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Visual Prompt:</p>
                            <p className="text-sm font-mono">{scene.prompt}</p>
                          </div>
                          {scene.script && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Avatar Script:</p>
                              <p className="text-sm italic">&quot;{scene.script}&quot;</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">AI Prompt:</p>
                    <p className="text-sm font-mono">{gen.ai_prompt}</p>
                    {gen.script && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Avatar Script:</p>
                        <p className="text-sm italic">&quot;{gen.script}&quot;</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default VideoGenerationsList;
