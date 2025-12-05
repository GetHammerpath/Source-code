import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Image as ImageIcon, Calendar, HardDrive, Upload } from "lucide-react";
import { format } from "date-fns";

interface Photo {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
}

interface SinglePhotoSelectorProps {
  selectedPhotoId: string | null;
  onPhotoSelect: (photoId: string | null) => void;
}

const SinglePhotoSelector = ({ selectedPhotoId, onPhotoSelect }: SinglePhotoSelectorProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("jobsite_photos")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    setUploading(true);
    const files = Array.from(event.target.files);

    try {
      let uploadedPhotoId: string | null = null;

      for (const file of files) {
        // Upload to storage with staging folder
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `staging/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('jobsite-photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('jobsite-photos')
          .getPublicUrl(filePath);

        // Insert into database with NULL request_id (will be assigned when request is created)
        const { data: photoData, error: insertError } = await supabase
          .from('jobsite_photos')
          .insert({
            request_id: null,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Keep track of the last uploaded photo ID
        if (photoData) {
          uploadedPhotoId = photoData.id;
        }
      }

      toast({
        title: "Success",
        description: `${files.length} photo(s) uploaded successfully`,
      });

      // Refresh photos and auto-select the last uploaded photo
      await fetchPhotos();
      if (uploadedPhotoId) {
        onPhotoSelect(uploadedPhotoId);
      }
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast({
        title: "Error",
        description: "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const filteredPhotos = photos.filter((photo) =>
    photo.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Loading photos...</p>
        </div>
      </Card>
    );
  }

  const renderPhotoGrid = () => (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search photos by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Photo Grid */}
      <RadioGroup value={selectedPhotoId || ""} onValueChange={onPhotoSelect}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredPhotos.map((photo) => (
            <div key={photo.id} className="relative group">
              <label
                htmlFor={photo.id}
                className={`block cursor-pointer rounded-lg border-2 transition-all overflow-hidden ${
                  selectedPhotoId === photo.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="aspect-square relative bg-muted">
                  <img
                    src={photo.file_url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selectedPhotoId === photo.id && (
                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                      <div className="bg-primary text-primary-foreground rounded-full p-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPreviewPhoto(photo);
                    }}
                    className="absolute top-2 right-2 bg-background/80 hover:bg-background p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-2 bg-card">
                  <p className="text-xs font-medium truncate">{photo.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(photo.file_size)}
                  </p>
                </div>
                <RadioGroupItem value={photo.id} id={photo.id} className="sr-only" />
              </label>
            </div>
          ))}
        </div>
      </RadioGroup>

      {filteredPhotos.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No photos found matching "{searchQuery}"</p>
        </div>
      )}
    </>
  );

  return (
    <>
      <Card className="p-4">
        <Tabs defaultValue="select" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="select" className="flex-1">
              Select Photo ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              Upload New
            </TabsTrigger>
            {selectedPhotoId && (
              <TabsTrigger value="selected" className="flex-1">
                Selected
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="select" className="mt-4">
            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No photos available yet</p>
                <p className="text-sm text-muted-foreground">Upload photos to get started</p>
              </div>
            ) : (
              renderPhotoGrid()
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload new photos for your video request
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

          {selectedPhotoId && (
            <TabsContent value="selected" className="mt-4">
              {(() => {
                const selectedPhoto = photos.find(p => p.id === selectedPhotoId);
                return selectedPhoto ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative w-full max-w-md aspect-square bg-muted rounded-lg overflow-hidden">
                      <img
                        src={selectedPhoto.file_url}
                        alt={selectedPhoto.file_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-medium">{selectedPhoto.file_name}</p>
                      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(selectedPhoto.file_size)}</span>
                        <span>•</span>
                        <span>{format(new Date(selectedPhoto.uploaded_at), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => onPhotoSelect(null)}
                    >
                      Deselect Photo
                    </Button>
                  </div>
                ) : null;
              })()}
            </TabsContent>
          )}
        </Tabs>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewPhoto.file_url}
                  alt={previewPhoto.file_name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{previewPhoto.file_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">{formatFileSize(previewPhoto.file_size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">
                      {format(new Date(previewPhoto.uploaded_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SinglePhotoSelector;
