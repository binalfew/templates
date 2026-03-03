import { useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "~/components/ui/button";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export function LogoUpload({ initialLogoUrl }: { initialLogoUrl?: string | null }) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
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
      setLogoUrl(reader.result as string);
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
    setLogoUrl("");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Logo</h3>
        <p className="text-xs text-muted-foreground">
          Upload an image to use as the tenant logo in the sidebar.
        </p>
      </div>

      {/* Hidden input for form submission */}
      <input type="hidden" name="logoUrl" value={logoUrl} />

      <div className="flex items-center gap-4">
        {/* Preview / Upload trigger */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/50 hover:bg-muted overflow-hidden"
        >
          {loading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : logoUrl ? (
            <img src={logoUrl} alt="Tenant logo" className="size-full object-contain p-1" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
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
              {logoUrl ? "Change" : "Upload"}
            </Button>
            {logoUrl && (
              <Button type="button" variant="outline" size="sm" onClick={handleRemove}>
                <X className="mr-1.5 size-3.5" />
                Remove
              </Button>
            )}
          </div>
          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
          <p className="text-xs text-muted-foreground">PNG, JPG, SVG, or WebP. Max 2 MB.</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.svg"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
