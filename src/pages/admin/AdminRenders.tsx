import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, RefreshCw, Play, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface VideoJob {
  id: string;
  user_id: string;
  provider: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  estimated_credits: number | null;
  credits_charged: number | null;
  status: string;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  profiles: {
    email: string;
  };
}

interface RenderStats {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  totalCreditsCharged: number;
  totalCreditsRefunded: number;
  avgCompletionTime: number | null;
}

const AdminRenders = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [stats, setStats] = useState<RenderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch video jobs with user info
      const { data: jobsData, error: jobsError } = await supabase
        .from("video_jobs")
        .select(`
          *,
          profiles!inner(email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (jobsError) throw jobsError;

      const formattedJobs: VideoJob[] = (jobsData || []).map((job: any) => ({
        ...job,
        profiles: job.profiles,
      }));

      setJobs(formattedJobs);

      // Calculate stats
      const completed = formattedJobs.filter((j) => j.status === "completed").length;
      const failed = formattedJobs.filter((j) => j.status === "failed").length;
      const processing = formattedJobs.filter(
        (j) => j.status === "processing" || j.status === "pending"
      ).length;

      const totalCreditsCharged = formattedJobs
        .filter((j) => j.status === "completed")
        .reduce((sum, j) => sum + (j.credits_charged || 0), 0);

      const totalCreditsRefunded = formattedJobs
        .filter((j) => j.status === "refunded")
        .reduce((sum, j) => sum + (j.credits_charged || 0), 0);

      // Calculate average completion time
      const completedJobs = formattedJobs.filter(
        (j) => j.status === "completed" && j.completed_at && j.created_at
      );
      const avgTime =
        completedJobs.length > 0
          ? completedJobs.reduce((sum, j) => {
              const start = new Date(j.created_at).getTime();
              const end = new Date(j.completed_at!).getTime();
              return sum + (end - start);
            }, 0) / completedJobs.length
          : null;

      setStats({
        total: formattedJobs.length,
        completed,
        failed,
        processing,
        totalCreditsCharged,
        totalCreditsRefunded,
        avgCompletionTime: avgTime,
      });
    } catch (error: any) {
      console.error("Error fetching render data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch render data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.profiles.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesProvider = providerFilter === "all" || job.provider === providerFilter;
    return matchesSearch && matchesStatus && matchesProvider;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "refunded":
        return <Badge variant="secondary">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Renders"
          subtitle="Monitor video generation jobs and retries"
          actions={
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(stats.avgCompletionTime)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Credits Summary */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Credits Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Charged</div>
                  <div className="text-2xl font-bold">{stats.totalCreditsCharged.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Refunded</div>
                  <div className="text-2xl font-bold text-red-600">
                    {stats.totalCreditsRefunded.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Video generation job history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or job ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="kie">Kie</SelectItem>
                  <SelectItem value="runway">Runway</SelectItem>
                  <SelectItem value="sora">Sora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No jobs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">{job.id.substring(0, 8)}...</TableCell>
                        <TableCell>{job.profiles.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {job.provider}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>
                          {job.credits_charged !== null
                            ? job.credits_charged.toLocaleString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>{job.retry_count}</TableCell>
                        <TableCell>
                          {format(new Date(job.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminRenders;
