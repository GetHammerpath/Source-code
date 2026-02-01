import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/dashboard/StatusBadge";
import PhotoSelector from "@/components/request/PhotoSelector";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  ArrowLeft, Building2, MapPin, User, Sparkles, Calendar, 
  FileText, Video, Palette, Ratio, Settings, Type, MessageSquare 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RequestDetails = () => {
  const { id } = useParams();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, canViewAllRequests } = useUserRole();

  useEffect(() => {
    checkAuth();
    fetchRequestDetails();
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    }
  };

  const fetchRequestDetails = async () => {
    setLoading(true);
    const { data: requestData, error: requestError } = await supabase
      .from("video_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (requestError || !requestData) {
      toast({
        title: "Error",
        description: "Failed to fetch request details",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setRequest(requestData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">{request.client_company_name}</h1>
              {request.title && (
                <p className="text-muted-foreground mt-1">{request.title}</p>
              )}
            </div>
            <StatusBadge status={request.status} />
          </div>

          {/* Company & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium min-w-[100px]">Name:</span>
                  <span className="text-sm">{request.client_company_name}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium min-w-[100px]">Type:</span>
                  <span className="text-sm capitalize">
                    {request.company_type.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm font-medium min-w-[100px]">Location:</span>
                  <span className="text-sm">{request.city_community}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium min-w-[100px]">Created:</span>
                  <span className="text-sm">
                    {new Date(request.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium min-w-[100px]">Updated:</span>
                  <span className="text-sm">
                    {new Date(request.updated_at).toLocaleString()}
                  </span>
                </div>
                {request.completed_at && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-[100px]">Completed:</span>
                    <span className="text-sm">
                      {new Date(request.completed_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Creative Direction */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Creative Direction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {request.visual_style && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-[120px]">Visual Style:</span>
                    <span className="text-sm capitalize">{request.visual_style}</span>
                  </div>
                )}
                {request.colors && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-[120px]">Colors:</span>
                    <span className="text-sm">{request.colors}</span>
                  </div>
                )}
                {request.scenes && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-[120px]">Scenes:</span>
                    <span className="text-sm">{request.scenes}</span>
                  </div>
                )}
                {request.aspect_ratio && (
                  <div className="flex items-start gap-2">
                    <Ratio className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm font-medium min-w-[120px]">Aspect Ratio:</span>
                    <span className="text-sm">{request.aspect_ratio}</span>
                  </div>
                )}
              </div>
              
              {request.caption && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Type className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Caption:</span>
                    </div>
                    <p className="text-sm bg-muted p-3 rounded-md">{request.caption}</p>
                  </div>
                </>
              )}
              
              {request.story_idea && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Story Idea:</span>
                    </div>
                    <p className="text-sm bg-muted p-3 rounded-md">{request.story_idea}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Avatar Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Avatar Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium min-w-[120px]">Character:</span>
                  <span className="text-sm">{request.character}</span>
                </div>
                {request.gender_avatar && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-[120px]">Gender:</span>
                    <span className="text-sm capitalize">{request.gender_avatar}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Technical Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Technical Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm font-medium min-w-[120px]">Render Mode:</span>
                <span className="text-sm font-mono">{request.render_mode}</span>
              </div>
            </CardContent>
          </Card>

          {/* Special Request */}
          {request.special_request && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Special Request
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm bg-muted p-3 rounded-md">{request.special_request}</p>
              </CardContent>
            </Card>
          )}

          {/* Photo Management */}
          <div className="mb-6">
            <PhotoSelector 
              requestId={id!} 
              canEdit={canViewAllRequests || request.user_id === currentUserId}
            />
          </div>

          {request.video_url && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Video</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a href={request.video_url} target="_blank" rel="noopener noreferrer">
                    View Video
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default RequestDetails;
