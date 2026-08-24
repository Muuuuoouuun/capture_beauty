export type ExportFormat = "png" | "jpeg" | "webp";

const MIME: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function exportFileName(format: ExportFormat, date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `capture-beauty-${stamp}.${format === "jpeg" ? "jpg" : format}`;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지 인코딩에 실패했습니다."))),
      MIME[format],
      format === "png" ? undefined : quality,
    );
  });
}

export async function downloadCanvas(canvas: HTMLCanvasElement, format: ExportFormat): Promise<void> {
  const blob = await canvasToBlob(canvas, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(format);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.");
  }
  const blob = await canvasToBlob(canvas, "png");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** 분석용 다운스케일: 긴 변을 maxDim 이하로 줄여 JPEG base64 로 반환 */
export function canvasToAnalysisBase64(
  canvas: HTMLCanvasElement,
  maxDim = 1024,
): { base64: string; mediaType: "image/jpeg" } {
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  let src = canvas;
  if (scale < 1) {
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(canvas.width * scale));
    small.height = Math.max(1, Math.round(canvas.height * scale));
    small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height);
    src = small;
  }
  const dataUrl = src.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
}
