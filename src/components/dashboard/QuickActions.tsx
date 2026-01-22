import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Video, HelpCircle, Sparkles } from "lucide-react";

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Create New Video",
      description: "Start generating an AI video from your image",
      icon: Plus,
      onClick: () => navigate("/video-generator"),
      variant: "default" as const,
      primary: true
    },
    {
      title: "View My Videos",
      description: "Browse all your video generations",
      icon: Video,
      onClick: () => {
        const element = document.getElementById('video-list');
        element?.scrollIntoView({ behavior: 'smooth' });
      },
      variant: "outline" as const
    },
    {
      title: "AI Tips",
      description: "Get better results with these tips",
      icon: Sparkles,
      onClick: () => {
        // Could open a modal with tips
      },
      variant: "outline" as const
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {actions.map((action) => (
        <Card 
          key={action.title}
          className={`cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
            action.primary ? 'border-primary/50 bg-primary/5' : 'border-border/50'
          }`}
          onClick={action.onClick}
        >
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-[14px] flex-shrink-0 ${
                action.primary ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted'
              }`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base tracking-tight">{action.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{action.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QuickActions;
