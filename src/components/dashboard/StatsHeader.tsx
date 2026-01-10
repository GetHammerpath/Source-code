import { Video, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsHeaderProps {
  generations: any[];
  userName?: string;
}

const StatsHeader = ({ generations, userName }: StatsHeaderProps) => {
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

  const stats = {
    total: generations.length,
    completed: generations.filter(g => getOverallStatus(g) === 'completed').length,
    generating: generations.filter(g => getOverallStatus(g) === 'generating').length,
    failed: generations.filter(g => getOverallStatus(g) === 'failed').length,
  };

  const statCards = [
    { 
      label: "Total Videos", 
      value: stats.total, 
      icon: Video, 
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    { 
      label: "Completed", 
      value: stats.completed, 
      icon: CheckCircle2, 
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    { 
      label: "In Progress", 
      value: stats.generating, 
      icon: Loader2, 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      animate: true
    },
    { 
      label: "Failed", 
      value: stats.failed, 
      icon: XCircle, 
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div>
        <h1 className="text-3xl font-bold">
          {userName ? `Welcome back, ${userName}!` : 'AI Video Dashboard'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage and track your AI-generated videos
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color} ${stat.animate ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default StatsHeader;
