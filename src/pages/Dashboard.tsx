import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Video, Loader2, CheckCircle2, XCircle, Clock, Film, Database, RotateCw, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const [userId, setUserId] = useState<string>("");
  const [avatars, setAvatars] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchAvatars();
      const channel = supabase
        .channel("dashboard_avatars_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "avatars",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchAvatars();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchVideos();
      const channel = supabase
        .channel("dashboard_videos_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kie_video_generations",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchVideos();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to view your avatars",
      });
      navigate("/auth");
    } else {
      setUserId(session.user.id);
    }
  };

  const fetchAvatars = async () => {
    try {
      const { data, error } = await supabase
        .from("avatars")
        .select("*")
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvatars(data || []);
    } catch (error) {
      console.error("Error fetching avatars:", error);
      toast({
        title: "Error",
        description: "Failed to load avatars",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("kie_video_generations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast({
        title: "Error",
        description: "Failed to load videos",
        variant: "destructive",
      });
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleRetryVideo = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    setRetryingId(videoId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to retry");
      const url = import.meta.env.VITE_SUPABASE_URL;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !anon) throw new Error("Missing app config");
      const res = await fetch(`${url}/functions/v1/kie-retry-generation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anon,
        },
        body: JSON.stringify({ generation_id: videoId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error || json?.message || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      if (json?.error) throw new Error(json.error);
      toast({ title: "Retry started", description: json?.message || "Video is being recreated." });
      fetchVideos();
    } catch (err) {
      toast({
        title: "Retry failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

  const getVideoStatusBadge = (gen: any) => {
    const status = gen.final_video_status ?? gen.initial_status ?? "pending";
    const errorType = gen.final_video_error ? (gen.metadata as any)?.error_type : undefined;
    switch (status) {
      case "completed":
        return <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Completed</span>;
      case "generating":
        return <Badge className="bg-blue-500/90 text-white text-xs"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating</Badge>;
      case "failed":
        if (errorType === "CREDIT_EXHAUSTED") return <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider">Credits</span>;
        return <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1"><XCircle className="h-2.5 w-2.5" />Failed</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Pending</span>;
    }
  };

  return (
    <div className="h-full w-full bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-10">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">Your avatars and videos in one place.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/bulk")} className="gap-2">
              <Database className="h-4 w-4" />
              Bulk Generate (Batch)
            </Button>
            <Button onClick={() => navigate("/create-avatar")} className="bg-[#002FA7] hover:bg-[#002080] text-white rounded-md shadow-sm" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create new Avatar
            </Button>
          </div>
        </div>

        {/* Your Avatars */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Your Avatars</h2>
          {loading ? (
            <div className="text-sm text-slate-600">Loading avatars...</div>
          ) : avatars.length === 0 ? (
            <Card className="rounded-md border-border/60 border shadow-sm">
              <CardContent className="p-8 text-center space-y-3">
                <div className="text-lg font-semibold text-slate-900">No avatars yet</div>
                <div className="text-sm text-slate-600">
                  Create your first avatar to unlock the workspace.
                </div>
                <div>
                  <Button className="bg-[#002FA7] hover:bg-[#002080] text-white rounded-md shadow-sm" onClick={() => navigate("/create-avatar")}>
                    Create an avatar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(`/avatar/${a.id}`)}
                  className="text-left"
                >
                  <Card className="rounded-md border-border/60 border shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
                    <div className="h-44 bg-slate-50">
                      <img
                        src={a.seed_image_url}
                        alt={a.name}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-4">
                      <div className="text-lg font-medium tracking-tight truncate text-slate-900">{a.name}</div>
                      <div className="text-xs text-slate-500 truncate mt-1">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Your Videos */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Your Videos</h2>
          {loadingVideos ? (
            <div className="text-sm text-slate-600">Loading videos...</div>
          ) : videos.length === 0 ? (
            <Card className="rounded-md border-border/60 border shadow-sm">
              <CardContent className="p-8 text-center space-y-3">
                <Film className="h-10 w-10 mx-auto text-slate-400" />
                <div className="text-lg font-semibold text-slate-900">No videos yet</div>
                <div className="text-sm text-slate-600">
                  Create a video from AI Video (Veo) or another generator.
                </div>
                <Button className="bg-[#002FA7] hover:bg-[#002080] text-white rounded-md shadow-sm" onClick={() => navigate("/video-generator")}>
                  Go to AI Video (Veo)
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((v) => {
                const thumbUrl = v.final_video_url ?? v.initial_video_url ?? null;
                const title = [v.industry, v.avatar_name].filter(Boolean).join(" – ") || "Video";
                const status = v.final_video_status ?? v.initial_status ?? "pending";
                const isFailed = status === "failed";
                const errorMsg = isFailed
                  ? (v.final_video_error ?? v.initial_error ?? v.extended_error ?? "Unknown error")
                  : null;
                const batchId = (v.metadata as { bulk_batch_id?: string })?.bulk_batch_id ?? null;
                return (
                  <div key={v.id} className="relative">
                    <button
                      type="button"
                      onClick={() => navigate(`/video/${v.id}`)}
                      className="text-left w-full"
                    >
                    <Card className={cn(
                      "rounded-md border-border/60 border shadow-sm hover:shadow-md transition-all overflow-hidden bg-white",
                      isFailed && "border-red-200 dark:border-red-900/50"
                    )}>
                      <div className="h-32 bg-slate-100 relative">
                        {thumbUrl ? (
                          <video
                            src={thumbUrl}
                            className="h-32 w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <div className="h-32 w-full flex items-center justify-center text-slate-400">
                            <Video className="h-10 w-10" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          {getVideoStatusBadge(v)}
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <div className="text-lg font-medium tracking-tight truncate text-slate-900">{title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {v.created_at ? new Date(v.created_at).toLocaleString() : ""}
                        </div>
                        {errorMsg && (
                          <>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2" title={errorMsg}>
                              {errorMsg}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2 h-8 text-xs"
                              onClick={(e) => handleRetryVideo(e, v.id)}
                              disabled={retryingId === v.id}
                            >
                              {retryingId === v.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <RotateCw className="h-3 w-3 mr-1" />
                              )}
                              Recreate
                            </Button>
                          </>
                        )}
                        {batchId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 text-xs w-full justify-start gap-1.5 text-blue-600 hover:text-blue-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/batch/${batchId}`);
                            }}
                          >
                            <Layers className="h-3 w-3" />
                            View batch
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
