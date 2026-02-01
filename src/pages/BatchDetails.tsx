import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, XCircle, Download, Loader2, Video, Clock, RotateCw } from "lucide-react";
import {
  getBatchStatus,
  resumeBatch,
  abortBatch,
  retryFailedBatch,
  type BatchStatus,
} from "@/lib/api/bulk";

const POLL_INTERVAL_MS = 5000;

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useCallback(callback, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(savedCallback, delay);
    return () => clearInterval(id);
  }, [delay, savedCallback]);
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed" || status === "cancelled"
        ? "destructive"
        : status === "paused_for_review"
          ? "secondary"
          : "default";

  const label =
    status === "generating"
      ? "Processing"
      : status === "paused_for_review"
        ? "Paused for Review"
        : status === "processing"
          ? "Processing"
          : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

  return <Badge variant={variant}>{label}</Badge>;
}

export default function BatchDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!id) return;
    const data = await getBatchStatus(id);
    setStatus(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useInterval(fetchStatus, id ? POLL_INTERVAL_MS : null);

  const handleResume = async () => {
    if (!id) return;
    setResuming(true);
    try {
      await resumeBatch(id);
      toast.success("Batch resumed");
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume");
    } finally {
      setResuming(false);
    }
  };

  const handleAbort = async () => {
    if (!id) return;
    setAborting(true);
    try {
      await abortBatch(id);
      toast.success("Batch cancelled");
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to abort");
    } finally {
      setAborting(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await retryFailedBatch(id);
      toast.success("Retrying failed generations");
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
    } finally {
      setRetrying(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!id || !status?.videos) return;
    const completed = status.videos.filter(
      (v) => v.video_url && (v.status === "completed" || v.video_url)
    );
    if (completed.length === 0) {
      toast.error("No completed videos to download");
      return;
    }
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`batch-${id}`) ?? zip;

      for (let i = 0; i < completed.length; i++) {
        const v = completed[i];
        if (!v.video_url) continue;
        const res = await fetch(v.video_url, { mode: "cors" });
        const blob = await res.blob();
        const name = `video-${v.variation_index + 1}.mp4`;
        folder.file(name, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `batch-${id}.zip`);
      toast.success(`Downloaded ${completed.length} videos`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (!id) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">Invalid batch ID</p>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">Batch not found</p>
        <Button variant="link" onClick={() => navigate("/bulk-video")}>
          Back to Bulk Video
        </Button>
      </div>
    );
  }

  const hasCompletedVideos = status.videos.some(
    (v) => v.video_url && (v.status === "completed" || v.video_url)
  );
  const isPaused = status.status === "paused_for_review";

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bulk-video")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{status.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{status.batch_id}</p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {isPaused && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <p className="font-medium mb-3">
              Test run complete. Review the 3 videos below.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleResume} disabled={resuming} className="gap-2">
                {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Continue Batch
              </Button>
              <Button variant="outline" onClick={handleAbort} disabled={aborting}>
                Abort
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Progress</CardTitle>
          {status.failed_count > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFailed}
              disabled={retrying}
              className="gap-2"
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Retry Failed ({status.failed_count})
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={status.progress} className="h-3" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Completed</p>
              <p className="font-medium">{status.completed_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pending</p>
              <p className="font-medium">{status.pending_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Failed</p>
              <p className="font-medium text-destructive">{status.failed_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time Remaining</p>
              <p className="font-medium">
                {status.time_remaining_estimate_sec != null
                  ? `${Math.ceil(status.time_remaining_estimate_sec / 60)} min`
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Videos</h2>
        {hasCompletedVideos && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloading}
            className="gap-2"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {status.videos.map((v) => (
          <Card key={v.id} className="overflow-hidden">
            <div className="aspect-video bg-muted relative">
              {v.video_url ? (
                <video
                  src={v.video_url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {v.status === "processing" || v.status === "pending" ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : v.status === "failed" ? (
                    <XCircle className="h-8 w-8 text-destructive" />
                  ) : (
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono">#{v.variation_index + 1}</span>
                {v.video_url && (
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Video className="h-3 w-3" />
                    View
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
