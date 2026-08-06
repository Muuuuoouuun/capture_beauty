import type { ComposeOptions } from "@/types";
import { layoutAndPaintFrame } from "./frame";
import { drawStamp } from "./stamp";

/** Renders the photo + frame + stamp onto the given canvas. */
export function composeImage(
  canvas: HTMLCanvasElement,
  options: ComposeOptions
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { image, frame, stamp, stampPosition, date, locationText, showStamp } =
    options;

  const layout = layoutAndPaintFrame(
    ctx,
    canvas,
    image.naturalWidth,
    image.naturalHeight,
    frame
  );

  ctx.drawImage(
    image,
    layout.photoX,
    layout.photoY,
    layout.photoWidth,
    layout.photoHeight
  );

  if (showStamp) {
    drawStamp({
      ctx,
      layout,
      stamp,
      position: stampPosition,
      date,
      locationText,
    });
  }
}
