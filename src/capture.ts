/** 화면 캡처: getDisplayMedia 로 한 프레임을 떠서 캔버스로 반환 */
export async function captureScreen(): Promise<HTMLCanvasElement> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("이 브라우저는 화면 캡처를 지원하지 않습니다.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      throw new Error("화면 캡처가 취소되었습니다.");
    }
    throw new Error("화면 캡처를 시작하지 못했습니다.");
  }

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // 첫 실제 프레임이 렌더링될 때까지 대기
    await new Promise<void>((resolve) => {
      if ("requestVideoFrameCallback" in video) {
        (video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => void;
        }).requestVideoFrameCallback(() => resolve());
      } else {
        setTimeout(resolve, 300);
      }
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 생성하지 못했습니다.");
    ctx.drawImage(video, 0, 0);
    return canvas;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** 파일/블롭 → 캔버스 */
export async function canvasFromBlob(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 생성하지 못했습니다.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export async function canvasFromDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 생성하지 못했습니다.");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** 클립보드에서 이미지 읽기 (버튼/단축키로 호출) */
export async function canvasFromClipboard(): Promise<HTMLCanvasElement> {
  if (!navigator.clipboard?.read) {
    throw new Error("이 브라우저는 클립보드 읽기를 지원하지 않습니다. Ctrl+V 를 사용해보세요.");
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) {
      const blob = await item.getType(type);
      return canvasFromBlob(blob);
    }
  }
  throw new Error("클립보드에 이미지가 없습니다.");
}
