import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import VideoGenerationCard from "@/components/video-generator/VideoGenerationCard";
import StatsHeader from "@/components/dashboard/StatsHeader";
import QuickActions from "@/components/dashboard/QuickActions";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Dashboard = () => {
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchGenerations();

      // Subscribe to real-time updates
      const channel = supabase
        .channel('dashboard_generations_changes')
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
    }
  }, [userId]);

  // Poll for status updates
  useEffect(() => {
    const pollStatus = async () => {
      const generatingItems = generations.filter(
        gen => gen.initial_status === 'generating' || 
               gen.extended_status === 'generating' ||
               gen.final_video_status === 'generating'
      );

      for (const gen of generatingItems) {
        try {
          if (gen.initial_status === 'generating' || gen.extended_status === 'generating') {
            await supabase.functions.invoke('kie-check-status', {
              body: { generation_id: gen.id }
            });
          }
          
          if (gen.final_video_status === 'generating') {
            await supabase.functions.invoke('fal-stitch-callback', {
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
      gen.extended_status === 'generating' ||
      gen.final_video_status === 'generating'
    )) {
      const interval = setInterval(pollStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [generations]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to view your videos",
      });
      navigate("/auth");
    } else {
      setUserId(session.user.id);
      // Get user's name from email or profile
      const email = session.user.email || "";
      const name = email.split("@")[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    }
  };

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

  const getOverallStatus = (gen: any) => {
    if (gen.final_video_url) return 'completed';
    if (gen.initial_status === 'generating' || 
        gen.extended_status === 'generating' ||
        gen.final_video_status === 'generating') return 'generating';
    if (gen.initial_status === 'failed' || 
        gen.extended_status === 'failed' ||
        gen.final_video_status === 'failed') return 'failed';
    return 'pending';
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
  };

  const filteredGenerations = generations
    .filter(gen => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        return (
          gen.industry?.toLowerCase().includes(searchLower) ||
          gen.avatar_name?.toLowerCase().includes(searchLower) ||
          gen.city?.toLowerCase().includes(searchLower) ||
          gen.story_idea?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(gen => {
      // Status filter
      if (statusFilter === "all") return true;
      return getOverallStatus(gen) === statusFilter;
    })
    .filter(gen => {
      // Date filter
      if (dateFilter === "all") return true;
      
      const createdDate = new Date(gen.created_at);
      const now = new Date();
      
      if (dateFilter === "today") {
        return createdDate.toDateString() === now.toDateString();
      }
      if (dateFilter === "7days") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return createdDate >= sevenDaysAgo;
      }
      if (dateFilter === "30days") {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return createdDate >= thirtyDaysAgo;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "status") {
        return getOverallStatus(b).localeCompare(getOverallStatus(a));
      }
      if (sortBy === "industry") {
        return (a.industry || '').localeCompare(b.industry || '');
      }
      return 0;
    });

  // Skeleton loader component
  const VideoSkeleton = () => (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex gap-4">
        <Skeleton className="w-32 h-20 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats Header */}
          <StatsHeader generations={generations} userName={userName} />
          
          {/* Quick Actions */}
          <QuickActions />

          {/* Video List Section */}
          <div id="video-list" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Videos</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      !
                    </span>
                  )}
                </Button>
                <Button onClick={() => navigate("/video-generator")} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Video
                </Button>
              </div>
            </div>

            {/* Collapsible Filters */}
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleContent>
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30 mb-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by industry, avatar, city, or story..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="generating">Generating</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="7days">Last 7 Days</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="status">By Status</SelectItem>
                        <SelectItem value="industry">By Industry</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Video Cards */}
            {loading ? (
              <div className="space-y-4">
                <VideoSkeleton />
                <VideoSkeleton />
                <VideoSkeleton />
              </div>
            ) : generations.length === 0 ? (
              <EmptyState />
            ) : filteredGenerations.length === 0 ? (
              <EmptyState hasFilters onClearFilters={clearFilters} />
            ) : (
              <div className="space-y-4">
                {filteredGenerations.map((gen) => (
                  <VideoGenerationCard
                    key={gen.id}
                    generation={gen}
                    onRefresh={fetchGenerations}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
