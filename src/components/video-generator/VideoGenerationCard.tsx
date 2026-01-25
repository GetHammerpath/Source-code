import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Clock, Plus, Download, Film, Video, ChevronDown, ChevronUp, Scissors, RefreshCw, AlertCircle, Edit, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import RetryEditModal from "./RetryEditModal";

interface VideoGenerationCardProps {
  generation: any;
  onRefresh?: () => void;
  onDuplicate?: (generation: any) => void;
}

const VideoGenerationCard = ({ generation, onRefresh, onDuplicate }: VideoGenerationCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [extending, setExtending] = useState(false);
  const [stitching, setStitching] = useState(false);
  const [trimSeconds, setTrimSeconds] = useState<number>(1);
  const [retrying, setRetrying] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);

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
      // Check if generation has enough segments before making the request
      const segments = generation.video_segments || [];
      if (segments.length < 2) {
        throw new Error(`Need at least 2 video segments to stitch. Currently have ${segments.length} segment(s). Wait for all scenes to complete.`);
      }
      const segmentsWithoutUrls = segments.filter((seg: any) => !seg.url && !seg.video_url);
      if (segmentsWithoutUrls.length > 0) {
        throw new Error(`${segmentsWithoutUrls.length} segment(s) are missing video URLs. Wait for scenes to finish generating.`);
      }

      const url = import.meta.env.VITE_SUPABASE_URL;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!url || !anon || !session) {
        throw new Error('Missing configuration or authentication');
      }

      const response = await fetch(`${url}/functions/v1/cloudinary-stitch-videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anon,
        },
        body: JSON.stringify({ 
          generation_id: generationId, 
          trim: true,
          trim_seconds: trimSeconds
        }),
      });

      let data: any = {};
      let responseText = '';
      try {
        responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse response:', parseError, 'Raw response:', responseText);
        // If parsing failed, try to extract error from text
        if (responseText) {
          data = { error: responseText.substring(0, 500) };
        }
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || data?.details || responseText || `Server error (${response.status})`;
        console.error('Stitching failed - Full error response:', {
          status: response.status,
          statusText: response.statusText,
          data,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(errorMsg);
      }

      if (!data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to stitch videos');
      }
      
      toast.success('Video stitching started!');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error stitching videos:', error);
      const errorMessage = error?.message || (error instanceof Error ? error.message : 'Failed to start stitching');
      toast.error('Stitching Failed', {
        description: errorMessage,
        duration: 10000,
      });
    } finally {
      setStitching(false);
    }
  };

  const getFailedSceneInfo = () => {
    if (generation.initial_status === 'failed') {
      const scenePrompts = generation.scene_prompts || [];
      const firstScene = scenePrompts[0] || {};
      return {
        sceneNumber: 1,
        prompt: firstScene.prompt || generation.ai_prompt || '',
        script: firstScene.script || '',
        error: generation.initial_error || 'Unknown error'
      };
    } else if (generation.extended_status === 'failed') {
      const currentScene = generation.current_scene || 1;
      const scenePrompts = generation.scene_prompts || [];
      const failedScene = scenePrompts[currentScene - 1] || {};
      return {
        sceneNumber: currentScene,
        prompt: failedScene.prompt || '',
        script: failedScene.script || '',
        error: generation.extended_error || 'Unknown error'
      };
    }
    return { sceneNumber: 1, prompt: '', script: '', error: '' };
  };

  const handleRetryWithEdits = async (editedPrompt: string, editedScript: string) => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('kie-retry-generation', {
        body: { 
          generation_id: generation.id,
          edited_prompt: editedPrompt,
          edited_script: editedScript
        }
      });
      
      if (error) throw error;
      
      toast.success(data.message || 'Retry started successfully!');
      setShowRetryModal(false);
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
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'generating':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 animate-pulse">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Generating
          </Badge>
        );
      case 'failed':
        if (errorType === 'CREDIT_EXHAUSTED') {
          return (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <AlertCircle className="mr-1 h-3 w-3" />
              Credits Exhausted
            </Badge>
          );
        }
        if (errorType === 'RATE_LIMITED') {
          return (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <Clock className="mr-1 h-3 w-3" />
              Rate Limited
            </Badge>
          );
        }
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
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

  const getProgressPercent = () => {
    if (!generation.is_multi_scene) return 0;
    const current = generation.current_scene || 1;
    const total = generation.number_of_scenes || 1;
    return Math.round((current / total) * 100);
  };

  const overallStatus = getOverallStatus();
  const thumbnail = getThumbnail();
  const progressPercent = getProgressPercent();

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`transition-all hover:shadow-md ${
        overallStatus === 'generating' ? 'border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10' :
        overallStatus === 'completed' ? 'border-green-500/30' :
        overallStatus === 'failed' ? 'border-destructive/30 bg-destructive/5' :
        ''
      }`}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-5 cursor-pointer">
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="flex-shrink-0 relative">
                {thumbnail ? (
                  <div className="w-36 h-24 rounded-lg overflow-hidden bg-muted">
                    <video
                      src={thumbnail}
                      className="w-full h-full object-cover"
                      muted
                    />
                    {overallStatus === 'completed' && (
                      <div className="absolute top-2 left-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-36 h-24 rounded-lg bg-muted flex items-center justify-center">
                    {overallStatus === 'generating' ? (
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    ) : (
                      <Film className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {generation.industry} - {generation.avatar_name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {truncateText(generation.story_idea || 'No description', 100)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{formatDistanceToNow(new Date(generation.created_at), { addSuffix: true })}</span>
                      <span>•</span>
                      <span>{generation.city}</span>
                      {generation.is_multi_scene && (
                        <>
                          <span>•</span>
                          <span>{generation.number_of_scenes} scenes</span>
                        </>
                      )}
                    </div>
                    
                    {/* Progress Bar for Multi-Scene */}
                    {generation.is_multi_scene && overallStatus === 'generating' && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-blue-600">
                            Scene {generation.current_scene || 1} of {generation.number_of_scenes}
                          </span>
                          <span className="text-muted-foreground">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    )}
                  </div>

                  {/* Status Badge & Expand */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {getStatusBadge(overallStatus, generation.metadata?.error_type)}
                    <div className={`p-1 rounded-full ${isExpanded ? 'bg-muted' : ''}`}>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        {/* Expanded Details */}
        <CollapsibleContent>
          <CardContent className="pt-0 px-5 pb-5 border-t">
            <div className="space-y-4 mt-4">
              {/* Story Idea */}
              {generation.story_idea && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">Story Idea</h4>
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
                            Part {index + 1} - {segment.duration ? `${(segment.duration / 1000).toFixed(0)}s` : '~8s'}
                          </span>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {segment.type}
                          </Badge>
                        </div>
                        <video
                          src={segment.url || segment.video_url}
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
                {/* Duplicate Button - Always visible */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate?.(generation);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="mr-2 h-3 w-3" />
                  Duplicate
                </Button>
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
                        Extend (+8s)
                      </>
                    )}
                  </Button>
                )}

                {generation.video_segments?.length >= 2 && (
                  <div className="flex items-center gap-2 w-full pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">
                        Trim:
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        max="3"
                        step="0.5"
                        value={trimSeconds}
                        onChange={(e) => setTrimSeconds(parseFloat(e.target.value))}
                        className="w-16 px-2 py-1 text-sm border rounded-md"
                      />
                      <span className="text-xs text-muted-foreground">sec</span>
                    </div>
                    <Button
                      onClick={() => handleStitchWithTrim(generation.id)}
                      size="sm"
                      disabled={stitching}
                      className="ml-auto"
                    >
                      {stitching ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Merging...
                        </>
                      ) : (
                        <>
                          <Scissors className="mr-2 h-3 w-3" />
                          Merge Videos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Final Video */}
              {generation.final_video_url && (
                <div className="border-2 border-green-500/50 rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Final Video Ready!
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        {(generation.video_segments?.reduce((sum: number, seg: any) => sum + (seg.duration || 8000), 0) / 1000 || 0).toFixed(0)}s
                      </Badge>
                    </h4>
                  </div>
                  
                  <video
                    src={generation.final_video_url}
                    controls
                    className="w-full rounded-lg mb-3"
                  />
                  
                  <Button className="w-full" asChild>
                    <a href={generation.final_video_url} download={`video-${generation.id}.mp4`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Video
                    </a>
                  </Button>
                </div>
              )}

              {/* Errors with Better Display */}
              {(generation.initial_error || generation.extended_error || generation.final_video_error) && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <XCircle className="h-5 w-5" />
                    Error Occurred
                  </div>
                  
                  {generation.initial_error && (
                    <div className="text-sm">
                      <span className="font-medium">Initial Generation:</span>
                      <p className="text-muted-foreground mt-1">{generation.initial_error}</p>
                    </div>
                  )}
                  
                  {generation.extended_error && (
                    <div className="text-sm">
                      <span className="font-medium">Extension:</span>
                      <p className="text-muted-foreground mt-1">{generation.extended_error}</p>
                    </div>
                  )}
                  
                  {generation.final_video_error && (
                    <div className="text-sm">
                      <span className="font-medium">Final Video:</span>
                      <p className="text-muted-foreground mt-1">{generation.final_video_error}</p>
                    </div>
                  )}

                  <Button
                    onClick={() => setShowRetryModal(true)}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit & Retry
                  </Button>
                </div>
              )}

              {/* Retry Edit Modal */}
              {(() => {
                const failedInfo = getFailedSceneInfo();
                return (
                  <RetryEditModal
                    open={showRetryModal}
                    onOpenChange={setShowRetryModal}
                    failedSceneNumber={failedInfo.sceneNumber}
                    originalPrompt={failedInfo.prompt}
                    originalScript={failedInfo.script}
                    errorMessage={failedInfo.error}
                    onRetry={handleRetryWithEdits}
                    isRetrying={retrying}
                  />
                );
              })()}

              {/* AI Details (Collapsed) */}
              <details className="border rounded-lg">
                <summary className="p-3 text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors">
                  View AI Details
                </summary>
                <div className="p-3 pt-0 space-y-3 border-t">
                  {generation.scene_prompts && generation.scene_prompts.length > 0 ? (
                    <div className="space-y-3">
                      {generation.scene_prompts.map((scene: any) => (
                        <div key={scene.scene_number} className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">
                            Scene {scene.scene_number}
                          </div>
                          <p className="text-sm font-mono">{scene.prompt}</p>
                          {scene.script && (
                            <p className="text-sm italic text-muted-foreground mt-2 border-t pt-2">
                              Script: "{scene.script}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : generation.ai_prompt ? (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        AI Prompt
                      </div>
                      <p className="text-sm font-mono">{generation.ai_prompt}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No AI details available</p>
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
