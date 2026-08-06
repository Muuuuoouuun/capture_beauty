import type { FrameStyle, FrameLayout } from "@/types";

/**
 * Computes canvas layout (total size + inner photo rect) for a given frame
 * style, then paints the frame background onto the canvas. The photo itself
 * is drawn separately by compose.ts using the returned layout.
 */
export function layoutAndPaintFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  photoWidth: number,
  photoHeight: number,
  frame: FrameStyle
): FrameLayout {
  switch (frame) {
    case "polaroid": {
      const border = Math.round(photoWidth * 0.045);
      const bottomBorder = Math.round(photoWidth * 0.16);
      const width = photoWidth + border * 2;
      const height = photoHeight + border + bottomBorder;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#fdfcf8";
      ctx.fillRect(0, 0, width, height);
      // subtle shadow under the paper edge
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fdfcf8";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      return {
        width,
        height,
        photoX: border,
        photoY: border,
        photoWidth,
        photoHeight,
      };
    }

    case "film-strip": {
      const border = Math.round(photoWidth * 0.05);
      const width = photoWidth + border * 2;
      const height = photoHeight + border * 2;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#0e0e0e";
      ctx.fillRect(0, 0, width, height);

      drawSprocketHoles(ctx, width, height, border);

      return {
        width,
        height,
        photoX: border,
        photoY: border,
        photoWidth,
        photoHeight,
      };
    }

    case "none":
    default: {
      canvas.width = photoWidth;
      canvas.height = photoHeight;
      return {
        width: photoWidth,
        height: photoHeight,
        photoX: 0,
        photoY: 0,
        photoWidth,
        photoHeight,
      };
    }
  }
}

function drawSprocketHoles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  border: number
) {
  const holeSize = border * 0.32;
  const holeRadius = holeSize * 0.28;
  const gap = holeSize * 1.6;
  const rowY = [border * 0.35, height - border * 0.65];

  ctx.fillStyle = "#f2ede4";
  for (const y of rowY) {
    for (let x = gap; x < width - gap / 2; x += gap) {
      roundRect(ctx, x, y, holeSize, holeSize * 0.7, holeRadius);
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
