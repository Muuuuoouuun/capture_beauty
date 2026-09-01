/**
 * 주석(annotation) 레이어 — 화살표 · 박스 · 형광펜 · 모자이크.
 *
 * 좌표는 모두 이미지 기준 정규화 값(0..1)이라 미리보기/원본 해상도 어디서든
 * 같은 결과가 나온다. 그리기는 캔버스 연산만 쓰고(픽셀 루프 없음) 모자이크도
 * drawImage 축소→확대로 처리해 드래그 중에도 즉시 반응한다.
 */

export type AnnotationKind = "arrow" | "box" | "highlight" | "mosaic";

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  /** 시작점 (정규화, 화살표는 꼬리) */
  x1: number;
  y1: number;
  /** 끝점 (정규화, 화살표는 촉) */
  x2: number;
  y2: number;
  color: string;
  /** 1..100 — 선 두께 / 모자이크 블록 크기 */
  size: number;
}

export interface AnnotationToolDef {
  id: AnnotationKind;
  name: string;
  /** icons.ts 의 아이콘 이름 */
  icon: "arrow" | "square" | "marker" | "mosaic";
}

export const ANNOTATION_TOOLS: AnnotationToolDef[] = [
  { id: "arrow", name: "화살표", icon: "arrow" },
  { id: "box", name: "박스", icon: "square" },
  { id: "highlight", name: "형광펜", icon: "marker" },
  { id: "mosaic", name: "모자이크", icon: "mosaic" },
];

export const DEFAULT_ANNOTATION_COLOR = "#ff3b5c";
export const DEFAULT_ANNOTATION_SIZE = 30;

/** 이 값보다 짧은 드래그는 실수로 보고 버린다 (이미지 짧은 변 비율) */
export const MIN_DRAG_RATIO = 0.012;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

let seq = 0;
export function createAnnotation(
  kind: AnnotationKind,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { color?: string; size?: number } = {},
): Annotation {
  return {
    id: `a${Date.now().toString(36)}${(seq++).toString(36)}`,
    kind,
    x1: clamp(x1, 0, 1),
    y1: clamp(y1, 0, 1),
    x2: clamp(x2, 0, 1),
    y2: clamp(y2, 0, 1),
    color: opts.color ?? DEFAULT_ANNOTATION_COLOR,
    size: clamp(opts.size ?? DEFAULT_ANNOTATION_SIZE, 1, 100),
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 정규화 좌표 → 이미지 영역 안의 픽셀 사각형 (좌상단 기준으로 정렬) */
export function annotationBox(a: Annotation, rect: Rect): Rect {
  const px1 = rect.x + a.x1 * rect.w;
  const py1 = rect.y + a.y1 * rect.h;
  const px2 = rect.x + a.x2 * rect.w;
  const py2 = rect.y + a.y2 * rect.h;
  return {
    x: Math.min(px1, px2),
    y: Math.min(py1, py2),
    w: Math.abs(px2 - px1),
    h: Math.abs(py2 - py1),
  };
}

/** 선 두께(px) — 이미지 짧은 변에 비례해 어느 해상도에서도 같은 굵기로 보인다 */
export function strokeWidthPx(size: number, shortSide: number): number {
  const s = clamp(size, 1, 100);
  return Math.max(1.5, shortSide * (0.003 + (s / 100) * 0.013));
}

/** 모자이크 블록 크기(px) */
export function mosaicBlockPx(size: number, shortSide: number): number {
  const s = clamp(size, 1, 100);
  return clamp(Math.round(shortSide * (0.006 + (s / 100) * 0.032)), 3, 160);
}

export interface ArrowGeometry {
  tipX: number;
  tipY: number;
  /** 촉에 가려지지 않도록 살짝 앞에서 끝나는 선의 끝점 */
  shaftX: number;
  shaftY: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  length: number;
}

const HEAD_ANGLE = 0.46; // rad — 촉 벌어짐

/** 꼬리(x1,y1) → 촉(x2,y2) 화살표의 삼각 촉 좌표 */
export function arrowGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  headLen: number,
): ArrowGeometry {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  // 짧은 화살표에서 촉이 선보다 길어지지 않게 제한
  const head = Math.min(headLen, length * 0.6);
  return {
    tipX: x2,
    tipY: y2,
    shaftX: x2 - Math.cos(ang) * head * 0.72,
    shaftY: y2 - Math.sin(ang) * head * 0.72,
    leftX: x2 - Math.cos(ang - HEAD_ANGLE) * head,
    leftY: y2 - Math.sin(ang - HEAD_ANGLE) * head,
    rightX: x2 - Math.cos(ang + HEAD_ANGLE) * head,
    rightY: y2 - Math.sin(ang + HEAD_ANGLE) * head,
    length,
  };
}

/** 너무 짧아 의미 없는 주석인지 */
export function isDegenerate(a: Annotation, shortSideRatioBase = 1): boolean {
  const dx = (a.x2 - a.x1) * shortSideRatioBase;
  const dy = (a.y2 - a.y1) * shortSideRatioBase;
  return Math.hypot(dx, dy) < MIN_DRAG_RATIO;
}

/** 점(px)이 주석 위에 있는지 — 선택/삭제용 */
export function hitTestAnnotation(a: Annotation, px: number, py: number, rect: Rect): boolean {
  const shortSide = Math.min(rect.w, rect.h);
  const tol = Math.max(6, strokeWidthPx(a.size, shortSide));
  if (a.kind === "arrow" || a.kind === "highlight") {
    const x1 = rect.x + a.x1 * rect.w;
    const y1 = rect.y + a.y1 * rect.h;
    const x2 = rect.x + a.x2 * rect.w;
    const y2 = rect.y + a.y2 * rect.h;
    return distanceToSegment(px, py, x1, y1, x2, y2) <= tol;
  }
  const b = annotationBox(a, rect);
  return (
    px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol
  );
}

export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/* =========================================================
 * 그리기 (캔버스)
 * ========================================================= */

/** 모자이크용 임시 캔버스 — 매 프레임 새로 만들지 않도록 재사용 */
let mosaicScratch: HTMLCanvasElement | null = null;

function scratch(): HTMLCanvasElement {
  if (!mosaicScratch) mosaicScratch = document.createElement("canvas");
  return mosaicScratch;
}

/**
 * 주석을 이미지 영역(rect) 안에 그린다. 모자이크는 ctx 캔버스의 현재 픽셀을
 * 축소→확대해 만들기 때문에 이미지가 이미 그려진 뒤에 호출해야 한다.
 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: readonly Annotation[],
  rect: Rect,
): void {
  if (annotations.length === 0) return;
  const shortSide = Math.min(rect.w, rect.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  for (const a of annotations) {
    const width = strokeWidthPx(a.size, shortSide);
    switch (a.kind) {
      case "mosaic":
        drawMosaic(ctx, annotationBox(a, rect), mosaicBlockPx(a.size, shortSide));
        break;
      case "box": {
        const b = annotationBox(a, rect);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        roundRect(ctx, b.x, b.y, b.w, b.h, Math.min(width * 1.2, Math.min(b.w, b.h) / 2));
        ctx.stroke();
        break;
      }
      case "highlight": {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.globalCompositeOperation = "multiply";
        ctx.strokeStyle = a.color;
        ctx.lineWidth = width * 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(rect.x + a.x1 * rect.w, rect.y + a.y1 * rect.h);
        ctx.lineTo(rect.x + a.x2 * rect.w, rect.y + a.y2 * rect.h);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "arrow": {
        const g = arrowGeometry(
          rect.x + a.x1 * rect.w,
          rect.y + a.y1 * rect.h,
          rect.x + a.x2 * rect.w,
          rect.y + a.y2 * rect.h,
          width * 4.2,
        );
        ctx.strokeStyle = a.color;
        ctx.fillStyle = a.color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(rect.x + a.x1 * rect.w, rect.y + a.y1 * rect.h);
        ctx.lineTo(g.shaftX, g.shaftY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(g.tipX, g.tipY);
        ctx.lineTo(g.leftX, g.leftY);
        ctx.lineTo(g.rightX, g.rightY);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  }
  ctx.restore();
}

function drawMosaic(ctx: CanvasRenderingContext2D, b: Rect, block: number): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const w = Math.round(b.w);
  const h = Math.round(b.h);
  if (w < 2 || h < 2) return;

  const tw = Math.max(1, Math.round(w / block));
  const th = Math.max(1, Math.round(h / block));
  const tmp = scratch();
  tmp.width = tw;
  tmp.height = th;
  const tctx = tmp.getContext("2d")!;
  // 축소는 "평균"으로 — 최근접 샘플링이면 블록마다 픽셀 하나만 남아
  // 원래 내용(작은 글자 등)이 읽힐 수 있다. 확대만 하드 블록으로 한다.
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "low";
  tctx.clearRect(0, 0, tw, th);
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tw, th);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
