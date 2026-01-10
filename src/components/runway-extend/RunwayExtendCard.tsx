import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Play, Download, Clock, Film, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface VideoSegment {
  scene: number;
  task_id: string;
  video_url: string;
  completed_at: string;
}

interface RunwayExtendGeneration {
  id: string;
  avatar_name: string;
  industry: string;
  city: string;
  number_of_scenes: number;
  current_scene: number;
  duration_per_scene: number;
  aspect_ratio: string;
  resolution: string;
  initial_status: string;
  initial_video_url: string | null;
  extended_status: string;
  extended_video_url: string | null;
  video_segments: VideoSegment[];
  final_video_url: string | null;
  final_video_status: string;
  created_at: string;
  image_url: string;
}

interface RunwayExtendCardProps {
  generation: RunwayExtendGeneration;
}

export function RunwayExtendCard({ generation }: RunwayExtendCardProps) {
  const completedScenes = generation.video_segments?.length || 0;
  const totalScenes = generation.number_of_scenes;
  const progress = (completedScenes / totalScenes) * 100;
  
  const isComplete = generation.final_video_status === 'completed' && generation.final_video_url;
  const isFailed = generation.initial_status === 'failed' || generation.extended_status === 'failed' || generation.final_video_status === 'failed';
  const isProcessing = !isComplete && !isFailed;

  const getStatusBadge = () => {
    if (isComplete) {
      return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</Badge>;
    }
    if (isFailed) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
    }
    if (generation.final_video_status === 'processing') {
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Stitching...</Badge>;
    }
    return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scene {generation.current_scene}/{totalScenes}</Badge>;
  };

  const handleDownload = () => {
    if (generation.final_video_url) {
      window.open(generation.final_video_url, '_blank');
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Thumbnail */}
        <div className="relative w-full md:w-48 h-32 md:h-auto shrink-0">
          {isComplete && generation.final_video_url ? (
            <video
              src={generation.final_video_url}
              className="w-full h-full object-cover"
              muted
              loop
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => {
                const video = e.target as HTMLVideoElement;
                video.pause();
                video.currentTime = 0;
              }}
            />
          ) : (
            <img
              src={generation.image_url}
              alt="Reference"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute top-2 left-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{generation.avatar_name}</h3>
              <p className="text-sm text-muted-foreground">{generation.industry} • {generation.city}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{format(new Date(generation.created_at), 'MMM d, yyyy')}</p>
              <p>{format(new Date(generation.created_at), 'h:mm a')}</p>
            </div>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{completedScenes}/{totalScenes} scenes</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Video Segments */}
          {generation.video_segments && generation.video_segments.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Completed Scenes:</p>
              <div className="flex flex-wrap gap-2">
                {generation.video_segments.map((segment, index) => (
                  <a
                    key={index}
                    href={segment.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    Scene {segment.scene}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Stats & Actions */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Film className="h-4 w-4" />
                {totalScenes} scenes
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {totalScenes * generation.duration_per_scene}s
              </span>
              <Badge variant="outline">{generation.aspect_ratio}</Badge>
              <Badge variant="outline">{generation.resolution}</Badge>
            </div>

            {isComplete && generation.final_video_url && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generation.final_video_url!, '_blank')}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
