import type { BackgroundOptions, FilterParams, RawImage, Stamp, TrimInsets } from "./types";
import { applyFilters, isNeutral } from "./filters";
import { computeLayout, getBackgroundPreset } from "./background";
import { drawStamp, type StampBounds } from "./stamps";
import { drawAnnotations, type Annotation } from "./annotations";

export interface RenderInput {
  /** 보정 대상 이미지 (트림은 이미 적용된 상태) */
  source: HTMLCanvasElement;
  filters: FilterParams;
  background: BackgroundOptions;
  stamps: Stamp[];
  /** 화살표·박스·형광펜·모자이크 (이미지 영역 안에만 그려짐) */
  annotations?: readonly Annotation[];
  /** 스탬프 날짜 고정용 (미지정 시 현재 시각) */
  now?: Date;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  /** 이미지가 출력 캔버스에서 차지하는 영역 */
  imageRect: { x: number; y: number; w: number; h: number };
  /** 스탬프 히트테스트 경계 (출력 캔버스 좌표) */
  stampBounds: Map<string, StampBounds>;
}

/** 트림 인셋만큼 잘라낸 새 캔버스 (인셋이 0이면 원본 그대로 반환) */
export function cropCanvas(source: HTMLCanvasElement, trim: TrimInsets): HTMLCanvasElement {
  const w = source.width - trim.left - trim.right;
  const h = source.height - trim.top - trim.bottom;
  if (w <= 0 || h <= 0 || (trim.left === 0 && trim.top === 0 && trim.right === 0 && trim.bottom === 0)) {
    return source;
  }
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(source, trim.left, trim.top, w, h, 0, 0, w, h);
  return out;
}

/** 임의 사각형으로 잘라낸 새 캔버스 */
export function cropCanvasRect(
  source: HTMLCanvasElement,
  rect: { x: number; y: number; w: number; h: number },
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.w));
  out.height = Math.max(1, Math.round(rect.h));
  out.getContext("2d")!.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, out.width, out.height);
  return out;
}

/** 지정한 가로 크기로 축소한 사본 (더 작으면 원본 그대로) */
export function scaleCanvasToWidth(source: HTMLCanvasElement, width: number): HTMLCanvasElement {
  if (width <= 0 || source.width <= width) return source;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.max(1, Math.round((source.height * width) / source.width));
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/** 긴 변이 maxDim 을 넘으면 축소한 사본, 아니면 원본 그대로 */
export function downscaleCanvas(source: HTMLCanvasElement, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  if (scale >= 1) return source;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(source.width * scale));
  out.height = Math.max(1, Math.round(source.height * scale));
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/** 캔버스 픽셀 → RawImage */
export function rawFromCanvas(canvas: HTMLCanvasElement): RawImage {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: d.width, height: d.height, data: d.data };
}

/** 필터 적용 결과 캐시 — 스탬프 드래그 등 무관한 변경에서 픽셀 연산 재실행 방지 */
interface FilterCache {
  key: string;
  canvas: HTMLCanvasElement;
}
let filterCache: FilterCache | null = null;

export function invalidateFilterCache(): void {
  filterCache = null;
}

function filteredCanvas(
  source: HTMLCanvasElement,
  filters: FilterParams,
  cacheToken: string,
): HTMLCanvasElement {
  if (isNeutral(filters)) return source;
  const key = `${cacheToken}|${source.width}x${source.height}|${JSON.stringify(filters)}`;
  if (filterCache?.key === key) return filterCache.canvas;

  const filtered = applyFilters(rawFromCanvas(source), filters);
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  out
    .getContext("2d")!
    .putImageData(new ImageData(filtered.data, filtered.width, filtered.height), 0, 0);
  filterCache = { key, canvas: out };
  return out;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * 합성 파이프라인: 필터 → 배경 레이아웃 → 그림자/모서리 → 스탬프.
 * cacheToken 은 원본 이미지 버전 식별자 (이미지 교체 시 변경).
 */
export function renderComposite(input: RenderInput, cacheToken = "0"): RenderResult {
  const filtered = filteredCanvas(input.source, input.filters, cacheToken);

  const layout = computeLayout(filtered.width, filtered.height, input.background);
  const out = document.createElement("canvas");
  out.width = layout.canvasW;
  out.height = layout.canvasH;
  const ctx = out.getContext("2d")!;

  const preset = getBackgroundPreset(input.background.preset);
  preset.draw(ctx, out.width, out.height, input.background.solidColor);

  const { x, y, contentW, contentH, radiusPx } = layout;

  if (preset.id !== "none" && input.background.shadow > 0) {
    const s = input.background.shadow / 100;
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.55 * s})`;
    ctx.shadowBlur = Math.min(contentW, contentH) * 0.09 * s;
    ctx.shadowOffsetY = Math.min(contentW, contentH) * 0.028 * s;
    ctx.fillStyle = "rgba(0,0,0,1)";
    roundRectPath(ctx, x, y, contentW, contentH, radiusPx);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  if (radiusPx > 0) {
    roundRectPath(ctx, x, y, contentW, contentH, radiusPx);
    ctx.clip();
  }
  ctx.drawImage(filtered, x, y);
  ctx.restore();

  // 주석은 이미지 위 · 스탬프 아래 (모자이크가 이미지 픽셀을 읽어야 하므로 이 순서)
  if (input.annotations?.length) {
    drawAnnotations(ctx, input.annotations, { x, y, w: contentW, h: contentH });
  }

  const stampBounds = new Map<string, StampBounds>();
  const now = input.now ?? new Date();
  for (const stamp of input.stamps) {
    stampBounds.set(stamp.id, drawStamp(ctx, stamp, x, y, contentW, contentH, now));
  }

  return { canvas: out, imageRect: { x, y, w: contentW, h: contentH }, stampBounds };
}
