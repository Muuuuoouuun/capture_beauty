"use client";

interface DownloadButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  disabled?: boolean;
}

export default function DownloadButton({
  canvasRef,
  disabled,
}: DownloadButtonProps) {
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capture-beauty-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled}
      className="w-full rounded-xl bg-rust px-6 py-3 font-semibold text-cream transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      이미지 다운로드
    </button>
  );
}
