"use client";

import { useCallback, useRef, useState } from "react";

interface UploaderProps {
  onImageSelected: (image: HTMLImageElement) => void;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Uploader({ onImageSelected }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드할 수 있어요.");
        return;
      }
      setError(null);
      try {
        const img = await loadImageFromFile(file);
        onImageSelected(img);
      } catch {
        setError("이미지를 불러오지 못했어요. 다시 시도해주세요.");
      }
    },
    [onImageSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
        isDragging
          ? "border-amber bg-amber/10"
          : "border-ink/20 hover:border-ink/40 bg-white/50"
      }`}
    >
      <span className="text-4xl">📷</span>
      <p className="font-medium">사진을 드래그하거나 클릭해서 업로드하세요</p>
      <p className="text-sm text-ink/50">JPG, PNG 지원</p>
      {error && <p className="text-sm text-rust">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
