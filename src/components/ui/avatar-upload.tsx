"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  onUpload: (url: string) => void;
  className?: string;
}

const sizeClasses = {
  sm: "size-12 text-sm",
  md: "size-16 text-xl",
  lg: "size-24 text-3xl",
  xl: "size-36 text-4xl",
};

export function AvatarUpload({
  src,
  name,
  size = "md",
  onUpload,
  className,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initial = name.charAt(0).toUpperCase() || "?";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onUpload(url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden bg-gradient-to-br from-[oklch(0.66_0.16_150)] to-[oklch(0.48_0.11_162)] text-white grid place-items-center shrink-0",
          sizeClasses[size]
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={name}
            fill
            sizes={size === "xl" ? "112px" : size === "lg" ? "80px" : size === "md" ? "56px" : "40px"}
            className="object-cover"
          />
        ) : (
          <span className="font-semibold">{initial}</span>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full cursor-pointer"
        >
          {uploading ? (
            <span className="text-xs text-white">...</span>
          ) : (
            <Upload className={cn("text-white", size === "xl" ? "size-6" : "size-4")} />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}