import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RunwayExtendCard } from "./RunwayExtendCard";
import { Loader2, Film } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RunwayExtendListProps {
  refreshTrigger?: number;
}

export function RunwayExtendList({ refreshTrigger }: RunwayExtendListProps) {
  const [generations, setGenerations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('runway_extend_generations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('runway-extend-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runway_extend_generations'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setGenerations(prev => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setGenerations(prev => 
              prev.map(gen => gen.id === payload.new.id ? payload.new as any : gen)
            );
          } else if (payload.eventType === 'DELETE') {
            setGenerations(prev => prev.filter(gen => gen.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No videos yet</h3>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Create your first Runway Extend video to see it here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {generations.map((generation) => (
        <RunwayExtendCard key={generation.id} generation={generation} />
      ))}
    </div>
  );
}
