import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Photo {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  selectedPhotoIds: string[];
  onTogglePhoto: (photoId: string) => void;
  onRemovePhoto: (photoId: string) => void;
  canEdit: boolean;
}

const PhotoGallery = ({ photos, selectedPhotoIds, onTogglePhoto, onRemovePhoto, canEdit }: PhotoGalleryProps) => {
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => {
          const isSelected = selectedPhotoIds.includes(photo.id);
          
          return (
            <div
              key={photo.id}
              className={`relative group rounded-lg border-2 overflow-hidden transition-all ${
                isSelected 
                  ? 'border-primary shadow-md' 
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <div className="aspect-square bg-muted relative">
                <img
                  src={photo.file_url}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPreviewPhoto(photo)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {canEdit && (
                    <>
                      {isSelected ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onRemovePhoto(photo.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onTogglePhoto(photo.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-2 bg-card">
                <p className="text-xs truncate font-medium">{photo.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(photo.file_size)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewPhoto?.file_name}</DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <div className="relative">
              <img
                src={previewPhoto.file_url}
                alt={previewPhoto.file_name}
                className="w-full h-auto rounded-lg"
              />
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Size: {formatFileSize(previewPhoto.file_size)}</p>
                <p>Uploaded: {new Date(previewPhoto.uploaded_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhotoGallery;