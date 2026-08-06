import type { FrameLayout, StampPosition, StampStyle } from "@/types";
import { formatClassicLed, formatMinimal } from "./date";

interface DrawStampArgs {
  ctx: CanvasRenderingContext2D;
  layout: FrameLayout;
  stamp: StampStyle;
  position: StampPosition;
  date: Date;
  locationText: string;
}

export function drawStamp({
  ctx,
  layout,
  stamp,
  position,
  date,
  locationText,
}: DrawStampArgs) {
  const margin = Math.round(layout.photoWidth * 0.035);

  switch (stamp) {
    case "classic-led":
      drawClassicLed(ctx, layout, position, margin, date);
      break;
    case "minimal-white":
      drawMinimalWhite(ctx, layout, position, margin, date);
      break;
    case "location-date":
      drawLocationDate(ctx, layout, position, margin, date, locationText);
      break;
  }
}

function anchor(
  layout: FrameLayout,
  position: StampPosition,
  margin: number
): { x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
  const right = layout.photoX + layout.photoWidth - margin;
  const left = layout.photoX + margin;
  const bottom = layout.photoY + layout.photoHeight - margin;
  const top = layout.photoY + margin;

  switch (position) {
    case "bottom-right":
      return { x: right, y: bottom, align: "right", baseline: "alphabetic" };
    case "bottom-left":
      return { x: left, y: bottom, align: "left", baseline: "alphabetic" };
    case "top-right":
      return { x: right, y: top, align: "right", baseline: "top" };
    case "top-left":
      return { x: left, y: top, align: "left", baseline: "top" };
  }
}

function drawClassicLed(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  position: StampPosition,
  margin: number,
  date: Date
) {
  const { x, y, align, baseline } = anchor(layout, position, margin);
  const fontSize = Math.round(layout.photoWidth * 0.032);

  ctx.save();
  ctx.font = `700 ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = "#ff5a1f";
  ctx.shadowColor = "rgba(255, 90, 31, 0.55)";
  ctx.shadowBlur = fontSize * 0.35;
  ctx.fillText(formatClassicLed(date), x, y);
  ctx.restore();
}

function drawMinimalWhite(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  position: StampPosition,
  margin: number,
  date: Date
) {
  const { x, y, align, baseline } = anchor(layout, position, margin);
  const fontSize = Math.round(layout.photoWidth * 0.024);

  ctx.save();
  ctx.font = `600 ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = fontSize * 0.3;
  ctx.shadowOffsetY = fontSize * 0.05;
  ctx.fillText(formatMinimal(date), x, y);
  ctx.restore();
}

function drawLocationDate(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  position: StampPosition,
  margin: number,
  date: Date,
  locationText: string
) {
  const { x, y, align, baseline } = anchor(layout, position, margin);
  const locFontSize = Math.round(layout.photoWidth * 0.026);
  const dateFontSize = Math.round(layout.photoWidth * 0.019);
  const lineGap = dateFontSize * 0.4;

  const isBottom = baseline === "alphabetic";
  const lines = locationText.trim()
    ? [locationText.trim().toUpperCase(), formatMinimal(date)]
    : [formatMinimal(date)];

  ctx.save();
  ctx.textAlign = align;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowOffsetY = 1;

  const orderedLines = isBottom ? [...lines].reverse() : lines;
  let cursorY = y;

  orderedLines.forEach((line) => {
    const isLocation = line === lines[0] && lines.length > 1;
    ctx.font = `${isLocation ? "700" : "500"} ${
      isLocation ? locFontSize : dateFontSize
    }px Helvetica, Arial, sans-serif`;
    ctx.shadowBlur = (isLocation ? locFontSize : dateFontSize) * 0.3;

    if (isBottom) {
      ctx.textBaseline = "alphabetic";
      ctx.fillText(line, x, cursorY);
      cursorY -= (isLocation ? locFontSize : dateFontSize) + lineGap;
    } else {
      ctx.textBaseline = "top";
      ctx.fillText(line, x, cursorY);
      cursorY += (isLocation ? locFontSize : dateFontSize) + lineGap;
    }
  });

  ctx.restore();
}
