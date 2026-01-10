import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Video } from "lucide-react";
import SoraStoryboardCard from "./SoraStoryboardCard";

interface SoraStoryboardListProps {
  userId: string;
}

const SoraStoryboardList = ({ userId }: SoraStoryboardListProps) => {
  const { data: generations, refetch } = useQuery({
    queryKey: ['sora-storyboard-generations', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kie_video_generations')
        .select('*')
        .eq('user_id', userId)
        .eq('model', 'sora-2-pro-storyboard')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  if (!generations) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (generations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Sora Videos Yet</h3>
          <p className="text-muted-foreground">
            Create your first cinematic Sora 2 Pro video above!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {generations.map((gen) => (
        <SoraStoryboardCard key={gen.id} generation={gen} onRefresh={refetch} />
      ))}
    </div>
  );
};

export default SoraStoryboardList;
