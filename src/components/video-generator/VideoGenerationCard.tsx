import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle2, XCircle, Clock, Plus, Download, Film, Video, ChevronDown, ChevronUp, Scissors, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VideoGenerationCardProps {
  generation: any;
  onRefresh?: () => void;
}

const VideoGenerationCard = ({ generation, onRefresh }: VideoGenerationCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [extending, setExtending] = useState(false);
  const [stitching, setStitching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [trimSeconds, setTrimSeconds] = useState<number>(1);
  const [retrying, setRetrying] = useState(false);

  const handleExtendNext = async (generationId: string) => {
    setExtending(true);
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
      onRefresh?.();
    } catch (error) {
      console.error('Error extending video:', error);
      toast.error("Extension Failed", {
        description: error instanceof Error ? error.message : "Failed to extend video",
      });
    } finally {
      setExtending(false);
    }
  };

  const handleStitchWithTrim = async (generationId: string) => {
    setStitching(true);
    try {
      const { data, error } = await supabase.functions.invoke('cloudinary-stitch-videos', {
        body: { 
          generation_id: generationId, 
          trim: true,
          trim_seconds: trimSeconds
        }
      });
      
      if (error) throw error;
      
      toast.success('Video stitching started with Cloudinary!');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error stitching videos:', error);
      toast.error(error.message || 'Failed to start stitching');
    } finally {
      setStitching(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('kie-retry-generation', {
        body: { generation_id: generation.id }
      });
      
      if (error) throw error;
      
      toast.success(data.message || 'Retry started successfully!');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error retrying generation:', error);
      toast.error(error.message || 'Failed to retry generation');
    } finally {
      setRetrying(false);
    }
  };

  const getOverallStatus = () => {
    if (generation.final_video_url) return 'completed';
    if (generation.initial_status === 'generating' || 
        generation.extended_status === 'generating' ||
        generation.final_video_status === 'generating') return 'generating';
    if (generation.initial_status === 'failed' || 
        generation.extended_status === 'failed' ||
        generation.final_video_status === 'failed') return 'failed';
    return 'pending';
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

  const getThumbnail = () => {
    if (generation.final_video_url) return generation.final_video_url;
    if (generation.video_segments?.length > 0) {
      return generation.video_segments[0].url;
    }
    return null;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const overallStatus = getOverallStatus();
  const thumbnail = getThumbnail();

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="hover:shadow-md transition-shadow">
        <CollapsibleTrigger asChild>
          <CardContent className="p-6 cursor-pointer">
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {thumbnail ? (
                  <div className="w-32 h-20 rounded-lg overflow-hidden bg-muted">
                    <video
                      src={thumbnail}
                      className="w-full h-full object-cover"
                      muted
                    />
                  </div>
                ) : (
                  <div className="w-32 h-20 rounded-lg bg-muted flex items-center justify-center">
                    <Film className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {generation.industry} Video - {generation.avatar_name} in {generation.city}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {truncateText(generation.story_idea || 'No description provided', 120)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{formatDistanceToNow(new Date(generation.created_at), { addSuffix: true })}</span>
                      {generation.is_multi_scene && (
                        <>
                          <span>•</span>
                          <span>{generation.number_of_scenes} scenes</span>
                        </>
                      )}
                      {generation.video_segments?.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{generation.video_segments.length} segments</span>
                        </>
                      )}
                    </div>
                    {generation.is_multi_scene && generation.current_scene < generation.number_of_scenes && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className="font-medium">
                            Scene {generation.current_scene || 1} of {generation.number_of_scenes}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${((generation.current_scene || 1) / generation.number_of_scenes) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(overallStatus, generation.metadata?.error_type)}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        {/* Expanded Details */}
        <CollapsibleContent>
          <CardContent className="pt-0 px-6 pb-6 border-t">
            <div className="space-y-4 mt-4">
              {/* Full Story Idea */}
              {generation.story_idea && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Story Idea</h4>
                  <p className="text-sm text-muted-foreground">{generation.story_idea}</p>
                </div>
              )}

              {/* Video Segments */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Video Segments ({generation.video_segments?.length || 0} parts)
                </h4>
                
                {generation.video_segments && generation.video_segments.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {generation.video_segments.map((segment: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">
                            Part {index + 1} - {(segment.duration / 1000).toFixed(0)}s
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

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {!generation.is_final && 
                 generation.extended_status === 'completed' && 
                 generation.video_segments?.length >= 2 && (
                  <Button
                    onClick={() => handleExtendNext(generation.id)}
                    variant="outline"
                    size="sm"
                    disabled={extending}
                  >
                    {extending ? (
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

                {generation.video_segments?.length >= 2 && (
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Trim Duration (seconds)
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.5"
                          value={trimSeconds}
                          onChange={(e) => setTrimSeconds(parseFloat(e.target.value))}
                          className="w-full px-3 py-1.5 text-sm border rounded-md"
                        />
                      </div>
                      <Button
                        onClick={() => handleStitchWithTrim(generation.id)}
                        variant="default"
                        size="sm"
                        disabled={stitching}
                        className="mt-5"
                      >
                        {stitching ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Merging...
                          </>
                        ) : (
                          <>
                            <Scissors className="mr-2 h-3 w-3" />
                            Smooth Merge (Trim)
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Removes the first {trimSeconds}s from each segment after the first one for smoother transitions
                    </p>
                  </div>
                )}
              </div>

              {/* Final Video */}
              {generation.final_video_url && (
                <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Final Video
                      <Badge variant="outline">
                        {(generation.video_segments?.reduce((sum: number, seg: any) => sum + seg.duration, 0) / 1000 || 0).toFixed(0)}s total
                      </Badge>
                    </h4>
                  </div>
                  
                  <video
                    src={generation.final_video_url}
                    controls
                    className="w-full rounded-lg mb-3"
                  />
                  
                  <Button variant="outline" className="w-full" asChild>
                    <a href={generation.final_video_url} download={`video-${generation.id}.mp4`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Final Video
                    </a>
                  </Button>
                </div>
              )}

              {/* Errors */}
              {generation.initial_error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Generation Error
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {generation.initial_error}
                  </p>
                </div>
              )}

              {generation.extended_error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Extension Error
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {generation.extended_error}
                  </p>
                </div>
              )}

              {generation.final_video_error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">
                    Final video error: {generation.final_video_error}
                  </p>
                </div>
              )}

              {/* Show Retry Button for Failed Generations */}
              {(generation.initial_status === 'failed' || generation.extended_status === 'failed') && (
                <Button
                  onClick={handleRetry}
                  disabled={retrying}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {retrying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Failed {generation.initial_status === 'failed' ? 'Scene 1' : `Scene ${generation.current_scene}`}
                    </>
                  )}
                </Button>
              )}

              {/* AI Details */}
              <details className="border rounded-lg p-3">
                <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                  View AI Details
                </summary>
                <div className="mt-3 space-y-3">
                  {generation.scene_prompts && generation.scene_prompts.length > 0 ? (
                    <div className="space-y-3">
                      {generation.scene_prompts.map((scene: any) => (
                        <div key={scene.scene_number} className="p-3 bg-muted rounded-lg">
                          <Badge className="mb-2">Scene {scene.scene_number}</Badge>
                          <div className="space-y-2">
                            {scene.action && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground">Action:</p>
                                <p className="text-xs">{scene.action}</p>
                              </div>
                            )}
                            {scene.script && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground">Script:</p>
                                <p className="text-xs">{scene.script}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : generation.ai_prompt && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">AI Prompt:</p>
                      <p className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-lg">
                        {generation.ai_prompt}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default VideoGenerationCard;
