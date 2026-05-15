import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket: "branding" | "avatars";
  prefix?: string;
  shape?: "square" | "circle";
  label?: string;
  accept?: string;
}

export function ImageUpload({
  value,
  onChange,
  bucket,
  prefix = "",
  shape = "square",
  label = "Upload image",
  accept = "image/png,image/jpeg,image/webp,image/svg+xml",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const cropToSquare = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      // Skip cropping for SVG (vector)
      if (file.type === "image/svg+xml") return resolve(file);
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const out = Math.min(size, 1024);
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          return reject(new Error("Canvas unsupported"));
        }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out);
        URL.revokeObjectURL(url);
        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
          mime,
          0.92,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      img.src = url;
    });

  const handle = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    setBusy(true);
    try {
      const cropped = shape === "circle" ? await cropToSquare(file) : file;
      const inferredExt =
        cropped.type === "image/png" ? "png" : cropped.type === "image/svg+xml" ? "svg" : "jpg";
      const ext = shape === "circle" ? inferredExt : file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${prefix}${prefix ? "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, cropped, {
        cacheControl: "3600",
        upsert: false,
        contentType: cropped.type || file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const rounded = shape === "circle" ? "rounded-full" : "rounded-md";

  return (
    <div className="flex items-center gap-3">
      <div className={`h-16 w-16 ${rounded} border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0`}>
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {label}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={busy}>
              <X className="h-3.5 w-3.5 mr-1.5" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or SVG. Max 5 MB.</p>
      </div>
    </div>
  );
}
