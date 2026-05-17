"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface BrandMarkProps {
  withWordmark?: boolean;
  className?: string;
  logoUrl?: string | null;
  editable?: boolean;
  onLogoChange?: (url: string) => void;
}

export function BrandMark({
  withWordmark = true,
  className,
  logoUrl,
  editable = false,
  onLogoChange,
}: BrandMarkProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "logo");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Upload failed (${res.status})`);
      }
      const { url } = await res.json();

      startTransition(() => {
        onLogoChange?.(url);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      console.error("Logo upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const showFallback = !logoUrl;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden bg-[oklch(0.18_0.008_80)] grid place-items-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]",
          showFallback ? "size-9" : "size-12"
        )}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo"
            fill
            sizes={editable ? "48px" : "36px"}
            className="object-cover"
            priority
          />
        ) : (
          <span className="serif italic text-[oklch(0.96_0.008_80)] text-[21px] leading-none -tracking-[0.5px] pointer-events-none">
            w
          </span>
        )}
{editable && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || pending}
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full cursor-pointer"
          >
            {uploading || pending ? (
              <span className="text-[10px] text-white">...</span>
            ) : (
              <Upload className="size-4 text-white" />
            )}
          </button>
        )}
        {error && (
          <div className="absolute -bottom-5 left-0 right-0 text-[10px] text-red-500 text-center whitespace-nowrap">
            {error}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {withWordmark && (
        <div className="leading-tight">
          <div className="text-[16px] font-semibold -tracking-[0.01em]">
            White Pops
          </div>
          <div className="text-[11.5px] font-medium tracking-[0.10em] uppercase text-muted-foreground mt-px">
            Saathi Prime
          </div>
        </div>
      )}
    </div>
  );
}