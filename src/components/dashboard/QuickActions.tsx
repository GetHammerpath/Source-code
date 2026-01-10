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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((action) => (
        <Card 
          key={action.title}
          className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
            action.primary ? 'border-primary bg-primary/5' : ''
          }`}
          onClick={action.onClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${action.primary ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QuickActions;
