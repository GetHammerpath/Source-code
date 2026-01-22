import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, Music, Image, FileText, Video, Search, 
  Plus, Trash2, Play, Download, Volume2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import StudioHeader from "@/components/layout/StudioHeader";
import { supabase } from "@/integrations/supabase/client";

interface Asset {
  id: string;
  name: string;
  type: "voice" | "music" | "broll" | "caption";
  url: string;
  duration?: number;
  size?: number;
  created_at: string;
}

const AssetLibrary = () => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"voice" | "music" | "broll" | "caption">("voice");

  useEffect(() => {
    fetchAssets();
  }, [activeTab]);

  const fetchAssets = async () => {
    setLoading(true);
    // In production, fetch from database
    // Mock data for now
    const mockAssets: Asset[] = [
      {
        id: "1",
        name: "Professional Male Voice",
        type: "voice",
        url: "#",
        duration: 120,
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Corporate Background Music",
        type: "music",
        url: "#",
        duration: 180,
        created_at: new Date().toISOString(),
      },
    ];
    setAssets(mockAssets.filter(a => a.type === activeTab));
    setLoading(false);
  };

  const handleUpload = async (type: string) => {
    toast({
      title: "Upload Feature",
      description: `Upload ${type} functionality will be implemented here.`,
    });
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIcon = (type: string) => {
    switch (type) {
      case "voice":
        return <Volume2 className="h-5 w-5" />;
      case "music":
        return <Music className="h-5 w-5" />;
      case "broll":
        return <Video className="h-5 w-5" />;
      case "caption":
        return <FileText className="h-5 w-5" />;
      default:
        return <Image className="h-5 w-5" />;
    }
  };

  return (
    <div className="h-full w-full bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-10 space-y-8">
        <StudioHeader
          title="Asset Library"
          subtitle="Centralized voice, music, b-roll, and caption assets"
          primaryAction={{
            label: `Upload ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`,
            onClick: () => handleUpload(activeTab),
            icon: <Plus className="h-4 w-4" />
          }}
        />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeTab} assets...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-[14px]"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="broll">B-Roll</TabsTrigger>
            <TabsTrigger value="caption">Captions</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading assets...
              </div>
            ) : filteredAssets.length === 0 ? (
              <Card className="rounded-[14px]">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    {getIcon(activeTab)}
                  </div>
                  <p className="text-muted-foreground mb-4">
                    No {activeTab} assets yet
                  </p>
                  <Button onClick={() => handleUpload(activeTab)} className="rounded-[14px]">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAssets.map((asset) => (
                  <Card key={asset.id} className="rounded-[14px] hover:shadow-md transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-[10px] bg-primary/10 flex items-center justify-center">
                            {getIcon(asset.type)}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-base">{asset.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {asset.duration && `${Math.floor(asset.duration / 60)}:${(asset.duration % 60).toString().padStart(2, '0')}`}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 rounded-[10px]">
                          <Play className="mr-2 h-3 w-3" />
                          Preview
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-[10px]">
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-[10px]">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AssetLibrary;
