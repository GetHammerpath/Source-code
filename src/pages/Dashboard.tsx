import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [userId, setUserId] = useState<string>("");
  const [avatars, setAvatars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="h-full w-full bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-10">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">Choose an avatar to start creating.</p>
          </div>
          <Button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Create New
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-600">Loading...</div>
        ) : avatars.length === 0 ? (
          <Card className="rounded-md border border-slate-200 shadow-sm">
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-lg font-semibold text-slate-900">No avatars yet</div>
              <div className="text-sm text-slate-600">
                Create your first avatar to unlock the workspace.
              </div>
              <div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-md" onClick={() => navigate("/")}>
                  Create an avatar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {avatars.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/avatar/${a.id}`)}
                className="text-left"
              >
                <Card className="rounded-md border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
                  <div className="h-44 bg-slate-50">
                    <img
                      src={a.seed_image_url}
                      alt={a.name}
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="font-mono font-semibold truncate text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
