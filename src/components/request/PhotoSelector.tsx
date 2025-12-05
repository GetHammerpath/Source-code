import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PhotoGallery from "./PhotoGallery";

interface Photo {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  request_id: string;
}

interface PhotoSelectorProps {
  requestId: string;
  canEdit: boolean;
}

const PhotoSelector = ({ requestId, canEdit }: PhotoSelectorProps) => {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPhotos();
    fetchSelectedPhotos();
  }, [requestId]);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from("jobsite_photos")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch photos",
        variant: "destructive",
      });
    } else {
      setAllPhotos(data || []);
    }
    setLoading(false);
  };

  const fetchSelectedPhotos = async () => {
    const { data, error } = await supabase
      .from("request_selected_photos")
      .select("photo_id")
      .eq("request_id", requestId);

    if (!error && data) {
      setSelectedPhotoIds(data.map(item => item.photo_id));
    }
  };

  const handleTogglePhoto = async (photoId: string) => {
    if (!canEdit) return;

    const isSelected = selectedPhotoIds.includes(photoId);
    
    if (isSelected) {
      // Remove from selection
      const { error } = await supabase
        .from("request_selected_photos")
        .delete()
        .eq("request_id", requestId)
        .eq("photo_id", photoId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to remove photo",
          variant: "destructive",
        });
      } else {
        setSelectedPhotoIds(prev => prev.filter(id => id !== photoId));
      }
    } else {
      // Add to selection
      const { error } = await supabase
        .from("request_selected_photos")
        .insert({ request_id: requestId, photo_id: photoId });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add photo",
          variant: "destructive",
        });
      } else {
        setSelectedPhotoIds(prev => [...prev, photoId]);
      }
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!canEdit) return;

    const { error } = await supabase
      .from("request_selected_photos")
      .delete()
      .eq("request_id", requestId)
      .eq("photo_id", photoId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove photo",
        variant: "destructive",
      });
    } else {
      setSelectedPhotoIds(prev => prev.filter(id => id !== photoId));
      toast({
        title: "Success",
        description: "Photo removed from request",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit || !event.target.files || event.target.files.length === 0) return;

    setUploading(true);
    const files = Array.from(event.target.files);

    try {
      for (const file of files) {
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${requestId}-${Date.now()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('jobsite-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('jobsite-photos')
          .getPublicUrl(fileName);

        // Insert into database
        const { data: photoData, error: insertError } = await supabase
          .from('jobsite_photos')
          .insert({
            request_id: requestId,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Auto-select newly uploaded photo
        if (photoData) {
          await supabase
            .from("request_selected_photos")
            .insert({ request_id: requestId, photo_id: photoData.id });
          
          setSelectedPhotoIds(prev => [...prev, photoData.id]);
        }
      }

      toast({
        title: "Success",
        description: `${files.length} photo(s) uploaded`,
      });

      // Refresh photos
      await fetchPhotos();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload photos",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const selectedPhotos = allPhotos.filter(photo => selectedPhotoIds.includes(photo.id));
  const availablePhotos = allPhotos.filter(photo => !selectedPhotoIds.includes(photo.id));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Loading Photos...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Images className="h-5 w-5" />
          Photos ({selectedPhotoIds.length} selected)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="selected" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="selected" className="flex-1">
              Selected ({selectedPhotoIds.length})
            </TabsTrigger>
            <TabsTrigger value="available" className="flex-1">
              Available ({availablePhotos.length})
            </TabsTrigger>
            {canEdit && (
              <TabsTrigger value="upload" className="flex-1">
                Upload New
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="selected" className="mt-4">
            {selectedPhotos.length > 0 ? (
              <PhotoGallery
                photos={selectedPhotos}
                selectedPhotoIds={selectedPhotoIds}
                onTogglePhoto={handleTogglePhoto}
                onRemovePhoto={handleRemovePhoto}
                canEdit={canEdit}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Images className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No photos selected</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="mt-4">
            {availablePhotos.length > 0 ? (
              <PhotoGallery
                photos={availablePhotos}
                selectedPhotoIds={selectedPhotoIds}
                onTogglePhoto={handleTogglePhoto}
                onRemovePhoto={handleRemovePhoto}
                canEdit={canEdit}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Images className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>All photos are already selected</p>
              </div>
            )}
          </TabsContent>

          {canEdit && (
            <TabsContent value="upload" className="mt-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload new photos to add to this request
                </p>
                <Button asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    {uploading ? 'Uploading...' : 'Select Files'}
                  </label>
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PhotoSelector;