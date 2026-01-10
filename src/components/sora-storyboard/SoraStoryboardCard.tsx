import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, ChevronDown, ChevronUp, Music, RefreshCw, XCircle, Loader2, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import RetryEditModal from "@/components/video-generator/RetryEditModal";

interface SoraStoryboardCardProps {
  generation: any;
  onRefresh: () => void;
}

const SoraStoryboardCard = ({ generation, onRefresh }: SoraStoryboardCardProps) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      generating: { variant: "default", label: "Generating..." },
      completed: { variant: "default", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" }
    };

    const config = statusMap[status] || statusMap.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getOverallStatus = () => {
    // For storyboard model, initial_status completion means the whole video is done
    if (generation.sora_model === 'sora-2-pro-storyboard' && generation.initial_status === 'completed') {
      return 'completed';
    }
    if (generation.final_video_status === 'completed') return 'completed';
    if (generation.initial_status === 'failed' || generation.extended_status === 'failed') return 'failed';
    if (generation.extended_status === 'generating') return 'generating';
    if (generation.initial_status === 'generating') return 'generating';
    return 'pending';
  };

  const overallStatus = getOverallStatus();

  const downloadVideo = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `sora-video-${generation.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Download Started",
        description: "Your video is being downloaded",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download video",
        variant: "destructive",
      });
    }
  };

  const getFailedSceneInfo = () => {
    const scenePrompts = generation.scene_prompts || [];
    const currentScene = generation.current_scene || 1;
    const failedSceneIndex = currentScene - 1;
    const failedScene = scenePrompts[failedSceneIndex] || {};
    
    return {
      sceneNumber: currentScene,
      prompt: failedScene.Scene || generation.ai_prompt || '',
      script: failedScene.script || '',
      error: generation.initial_error || generation.extended_error || 'Unknown error'
    };
  };

  const handleRetryWithEdits = async (editedPrompt: string, editedScript: string) => {
    setIsRetrying(true);

    try {
      // Update the scene prompts with edited values
      const updatedScenePrompts = [...(generation.scene_prompts || [])];
      const failedSceneIndex = (generation.current_scene || 1) - 1;
      
      if (updatedScenePrompts[failedSceneIndex]) {
        updatedScenePrompts[failedSceneIndex] = {
          ...updatedScenePrompts[failedSceneIndex],
          Scene: editedPrompt,
          script: editedScript
        };
      }

      const { error } = await supabase.functions.invoke('sora-generate-video', {
        body: {
          generation_id: generation.id,
          prompt: editedPrompt || generation.scene_prompts?.[0]?.Scene || generation.ai_prompt,
          image_url: generation.image_url,
          model: 'sora-2-pro-storyboard',
          aspect_ratio: generation.aspect_ratio,
          duration: generation.duration,
          watermark: generation.watermark,
          audio_enabled: generation.audio_enabled,
          shots: updatedScenePrompts
        }
      });

      if (error) throw error;

      toast({
        title: "Retry Started",
        description: "Video generation has been restarted with your edits",
      });

      setShowRetryModal(false);
      onRefresh();
    } catch (error: any) {
      console.error('Retry error:', error);
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to restart generation",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const totalDuration = generation.scene_prompts?.reduce((sum: number, shot: any) => sum + (shot.duration || 0), 0) || 0;

  return (
    <Card className="border-amber-200/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {generation.industry} - {generation.avatar_name}
            </CardTitle>
            <CardDescription className="mt-2">
              {generation.city} | {generation.number_of_scenes} scene(s) | 
              {generation.duration}s each | 1080p HD
              {totalDuration > 0 && ` | Total: ${totalDuration}s`}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-700">Sora 2 Pro</Badge>
              {generation.audio_enabled && (
                <Badge variant="secondary">
                  <Music className="h-3 w-3 mr-1" />
                  Audio
                </Badge>
              )}
            </div>
            {getStatusBadge(overallStatus)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Video Preview */}
        {(generation.final_video_url || generation.initial_video_url) && (
          <div className="space-y-4">
            <video
              src={generation.final_video_url || generation.initial_video_url}
              controls
              className="w-full rounded-lg"
              poster={generation.image_url}
            />

            {/* Audio Player (if separate) */}
            {generation.metadata?.audio_url && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Music className="h-4 w-4 text-amber-600" />
                <audio src={generation.metadata.audio_url} controls className="flex-1" />
              </div>
            )}

            {/* Download Options */}
            <div className="flex gap-2">
              <Button onClick={() => downloadVideo(generation.final_video_url || generation.initial_video_url)}>
                <Download className="mr-2 h-4 w-4" />
                Download Video
              </Button>
              {generation.metadata?.audio_url && (
                <Button variant="outline" onClick={() => downloadVideo(generation.metadata.audio_url)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Audio
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {(overallStatus === 'generating' || overallStatus === 'pending') && !generation.final_video_url && !generation.initial_video_url && (
          <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" />
              <p className="text-sm text-muted-foreground">
                Generating your Sora 2 Pro video... This may take 2-3 minutes per scene.
              </p>
            </div>
          </div>
        )}

        {/* Scene Progress (for multi-scene) */}
        {generation.is_multi_scene && (
          <div className="space-y-2">
            <Label>Scene Progress</Label>
            <div className="flex gap-2">
              {Array.from({ length: generation.number_of_scenes }).map((_, i) => {
                const sceneNum = i + 1;
                const isCompleted = sceneNum < (generation.current_scene || 1);
                const isCurrent = sceneNum === (generation.current_scene || 1);
                const isPending = sceneNum > (generation.current_scene || 1);

                return (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-1 h-2 rounded transition-all",
                      isCompleted && "bg-green-500",
                      isCurrent && "bg-amber-500 animate-pulse",
                      isPending && "bg-muted"
                    )} 
                  />
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Scene {generation.current_scene || 1} of {generation.number_of_scenes}
            </p>
          </div>
        )}

        {/* Expand for Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              {isExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {isExpanded ? 'Hide' : 'Show'} Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Scene Prompts */}
            {generation.scene_prompts && generation.scene_prompts.length > 0 && (
              <div className="space-y-3">
                <Label>Scene Prompts</Label>
                {generation.scene_prompts.map((scene: any, i: number) => (
                  <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Scene {i + 1}</Label>
                      <Badge variant="outline">{scene.duration}s</Badge>
                    </div>
                    <p className="text-sm">{scene.Scene}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Story Idea */}
            {generation.story_idea && (
              <div>
                <Label>Story Idea</Label>
                <p className="text-sm text-muted-foreground mt-1">{generation.story_idea}</p>
              </div>
            )}

            {/* Error Details */}
            {(generation.initial_error || generation.extended_error) && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Generation Error</AlertTitle>
                <AlertDescription>
                  {generation.initial_error || generation.extended_error}
                </AlertDescription>
              </Alert>
            )}

            {/* Technical Details */}
            {generation.metadata && (
              <div className="text-xs text-muted-foreground space-y-1">
                {generation.metadata.sora_credits_consumed && (
                  <p>Credits Used: {generation.metadata.sora_credits_consumed}</p>
                )}
                {generation.metadata.cost_time && (
                  <p>Generation Time: {generation.metadata.cost_time}s</p>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        {overallStatus === 'failed' && (
          <Button 
            onClick={() => setShowRetryModal(true)}
            variant="outline"
            className="w-full"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit & Retry
          </Button>
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
              isRetrying={isRetrying}
            />
          );
        })()}
      </CardContent>
    </Card>
  );
};

export default SoraStoryboardCard;
