import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Video, Download, XCircle, CheckCircle2, Loader2, Film, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VideoDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideo();
  }, [id]);

  const fetchVideo = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kie_video_generations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({
          title: "Video not found",
          description: "This video may have been deleted.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      setVideo(data);
    } catch (err) {
      console.error("Error fetching video:", err);
      toast({
        title: "Error",
        description: "Failed to load video",
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!video) return null;

  const status = video.final_video_status ?? video.initial_status ?? "pending";
  const videoUrl = video.final_video_url ?? video.initial_video_url;
  const title = [video.industry, video.avatar_name].filter(Boolean).join(" – ") || "Video";
  const hasError = video.initial_error || video.extended_error || video.final_video_error;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 truncate">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {video.created_at ? new Date(video.created_at).toLocaleString() : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "completed" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </span>
          )}
          {status === "generating" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating
            </span>
          )}
          {status === "failed" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-600">
              <XCircle className="h-4 w-4" />
              Failed
            </span>
          )}
          {status === "pending" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-500/10 text-slate-600">
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Video player */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          {videoUrl ? (
            <div className="space-y-3">
              <video
                src={videoUrl}
                controls
                className="w-full rounded-lg bg-black aspect-video max-h-[480px]"
              />
              <Button asChild>
                <a href={videoUrl} download={`video-${video.id}.mp4`}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-slate-100 flex items-center justify-center">
              {status === "generating" ? (
                <Loader2 className="h-12 w-12 text-slate-400 animate-spin" />
              ) : (
                <Film className="h-12 w-12 text-slate-400" />
              )}
              <p className="text-slate-500 ml-3">
                {status === "generating" ? "Video is being generated..." : "No video available"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Errors section */}
      {hasError && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {video.initial_error && (
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Initial generation</p>
                <p className="text-sm text-red-600/90 dark:text-red-400/90 mt-0.5">{video.initial_error}</p>
              </div>
            )}
            {video.extended_error && (
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Extension</p>
                <p className="text-sm text-red-600/90 dark:text-red-400/90 mt-0.5">{video.extended_error}</p>
              </div>
            )}
            {video.final_video_error && (
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Final video</p>
                <p className="text-sm text-red-600/90 dark:text-red-400/90 mt-0.5">{video.final_video_error}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/video-generator")}>
              Go to Studio to retry
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default VideoDetails;
