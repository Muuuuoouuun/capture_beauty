"use client";

import { useEffect, useRef, useState } from "react";
import Uploader from "@/components/Uploader";
import CanvasPreview from "@/components/CanvasPreview";
import ControlPanel from "@/components/ControlPanel";
import DownloadButton from "@/components/DownloadButton";
import { composeImage } from "@/lib/canvas/compose";
import type { FrameStyle, StampPosition, StampStyle } from "@/types";

function todayInputValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const [frame, setFrame] = useState<FrameStyle>("polaroid");
  const [stamp, setStamp] = useState<StampStyle>("classic-led");
  const [stampPosition, setStampPosition] =
    useState<StampPosition>("bottom-right");
  const [showStamp, setShowStamp] = useState(true);
  const [date, setDate] = useState(todayInputValue());
  const [locationText, setLocationText] = useState("");

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    composeImage(canvasRef.current, {
      image,
      frame,
      stamp,
      stampPosition,
      date: date ? new Date(`${date}T00:00:00`) : new Date(),
      locationText,
      showStamp,
    });
  }, [image, frame, stamp, stampPosition, date, locationText, showStamp]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Capture Beauty
        </h1>
        <p className="mt-2 text-ink/60">
          예쁘게 캡쳐되는 앱 — 사진에 필름카메라 감성 프레임과 타임스탬프를
          더해보세요.
        </p>
      </header>

      {!image ? (
        <div className="mx-auto w-full max-w-xl">
          <Uploader onImageSelected={setImage} />
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            <CanvasPreview ref={canvasRef} />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="self-start text-sm text-ink/50 underline underline-offset-2 hover:text-ink"
            >
              다른 사진 선택
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <ControlPanel
              frame={frame}
              onFrameChange={setFrame}
              stamp={stamp}
              onStampChange={setStamp}
              stampPosition={stampPosition}
              onStampPositionChange={setStampPosition}
              showStamp={showStamp}
              onShowStampChange={setShowStamp}
              date={date}
              onDateChange={setDate}
              locationText={locationText}
              onLocationChange={setLocationText}
            />
            <DownloadButton canvasRef={canvasRef} disabled={!image} />
          </div>
        </div>
      )}
    </main>
  );
}
