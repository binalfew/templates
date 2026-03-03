import { useState, useRef } from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export function PhotoUpload({
  initialPhotoUrl,
  fallbackInitials,
}: {
  initialPhotoUrl?: string | null;
  fallbackInitials: string;
}) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage("");

    if (file.size > MAX_SIZE_BYTES) {
      setErrorMessage("File exceeds 2 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setLoading(false);
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read file.");
      setLoading(false);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemove() {
    setPhotoUrl("");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Profile Photo</h3>
        <p className="text-xs text-muted-foreground">Upload a photo for your profile avatar.</p>
      </div>

      <input type="hidden" name="photoUrl" value={photoUrl} />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group"
        >
          <Avatar className="size-20 border-2 border-border">
            {loading ? (
              <AvatarFallback>
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </AvatarFallback>
            ) : photoUrl ? (
              <AvatarImage src={photoUrl} alt="Profile photo" />
            ) : (
              <AvatarFallback className="text-lg">{fallbackInitials}</AvatarFallback>
            )}
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="size-5 text-white" />
          </div>
        </button>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="mr-1.5 size-3.5" />
              {photoUrl ? "Change" : "Upload"}
            </Button>
            {photoUrl && (
              <Button type="button" variant="outline" size="sm" onClick={handleRemove}>
                <X className="mr-1.5 size-3.5" />
                Remove
              </Button>
            )}
          </div>
          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
          <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Max 2 MB.</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
