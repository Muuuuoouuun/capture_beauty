"use client";

import { forwardRef } from "react";

const CanvasPreview = forwardRef<HTMLCanvasElement>((_props, ref) => {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-white/40 p-6">
      <canvas
        ref={ref}
        className="max-h-[70vh] max-w-full rounded-sm shadow-xl"
      />
    </div>
  );
});

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
