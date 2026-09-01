import type { BackgroundOptions, RawImage, TrimInsets } from "./types";

export function defaultBackgroundOptions(): BackgroundOptions {
  return {
    preset: "none",
    solidColor: "#1e293b",
    padding: 0.08,
    radius: 0.02,
    shadow: 45,
    ratio: "auto",
  };
}

export const RATIO_CHOICES = ["auto", "16:9", "4:3", "3:2", "1:1", "9:16"] as const;

/** '16:9' → 16/9. 'auto' 나 잘못된 값은 null */
export function parseRatio(ratio: string): number | null {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ratio.trim());
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

export interface Layout {
  canvasW: number;
  canvasH: number;
  /** 콘텐츠(캡처 이미지)가 놓이는 위치 */
  x: number;
  y: number;
  contentW: number;
  contentH: number;
  padPx: number;
  radiusPx: number;
}

/**
 * 출력 캔버스 레이아웃 계산.
 * - 여백(padding)은 콘텐츠 짧은 변 기준 비율.
 * - 비율이 지정되면 최소 여백을 보장한 뒤 부족한 축을 늘려 정확히 맞춘다.
 * - 배경이 'none' 이고 비율이 auto 면 여백 없이 원본 크기 그대로.
 */
export function computeLayout(contentW: number, contentH: number, opts: BackgroundOptions): Layout {
  const short = Math.min(contentW, contentH);
  const noBackdrop = opts.preset === "none" && opts.ratio === "auto";
  const padPx = noBackdrop ? 0 : Math.round(short * clamp01(opts.padding, 0.5));
  const radiusPx = opts.preset === "none" ? 0 : Math.round(short * clamp01(opts.radius, 0.2));

  let canvasW = contentW + padPx * 2;
  let canvasH = contentH + padPx * 2;

  const r = parseRatio(opts.ratio);
  if (r !== null) {
    if (canvasW / canvasH < r) {
      canvasW = Math.round(canvasH * r);
    } else {
      canvasH = Math.round(canvasW / r);
    }
  }

  return {
    canvasW,
    canvasH,
    x: Math.round((canvasW - contentW) / 2),
    y: Math.round((canvasH - contentH) / 2),
    contentW,
    contentH,
    padPx,
    radiusPx,
  };
}

function clamp01(v: number, max: number): number {
  return v < 0 ? 0 : v > max ? max : v;
}

/**
 * 창 캡처 주변의 균일한 테두리(빈 여백)를 감지한다.
 * 네 모서리 색이 서로 비슷할 때만 동작하며, 각 변에서 균일한 줄을 안쪽으로 스캔한다.
 * 실제 크롭은 호출측에서 수행한다.
 */
export function detectTrim(img: RawImage, tolerance = 12): TrimInsets {
  const { width: w, height: h, data } = img;
  const none: TrimInsets = { left: 0, top: 0, right: 0, bottom: 0 };
  if (w < 8 || h < 8) return none;

  const px = (x: number, y: number): [number, number, number, number] => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const close = (a: [number, number, number, number], b: [number, number, number, number], tol: number) =>
    Math.abs(a[0] - b[0]) <= tol &&
    Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol &&
    Math.abs(a[3] - b[3]) <= tol * 2;

  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const ref = corners[0];
  if (!corners.every((c) => close(c, ref, tolerance))) return none;

  const rowUniform = (y: number): boolean => {
    for (let x = 0; x < w; x++) if (!close(px(x, y), ref, tolerance)) return false;
    return true;
  };
  const colUniform = (x: number): boolean => {
    for (let y = 0; y < h; y++) if (!close(px(x, y), ref, tolerance)) return false;
    return true;
  };

  const maxTrimX = Math.floor(w * 0.45);
  const maxTrimY = Math.floor(h * 0.45);

  let top = 0;
  while (top < maxTrimY && rowUniform(top)) top++;
  let bottom = 0;
  while (bottom < maxTrimY && rowUniform(h - 1 - bottom)) bottom++;
  let left = 0;
  while (left < maxTrimX && colUniform(left)) left++;
  let right = 0;
  while (right < maxTrimX && colUniform(w - 1 - right)) right++;

  if (left + right >= w || top + bottom >= h) return none;
  return { left, top, right, bottom };
}

export function hasTrim(t: TrimInsets): boolean {
  return t.left > 0 || t.top > 0 || t.right > 0 || t.bottom > 0;
}

/* ---------- 배경 프리셋 ---------- */

type Ctx2D = CanvasRenderingContext2D;

export interface BackgroundPreset {
  id: string;
  name: string;
  /** UI 미리보기용 CSS background 값 */
  css: string;
  draw: (ctx: Ctx2D, w: number, h: number, solidColor: string) => void;
}

function linear(ctx: Ctx2D, w: number, h: number, stops: [number, string][], angleDeg = 135): void {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = w / 2, cy = h / 2;
  const len = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;
  const g = ctx.createLinearGradient(
    cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
    cx + Math.cos(rad) * len, cy + Math.sin(rad) * len,
  );
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx: Ctx2D, w: number, h: number, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "none",
    name: "없음",
    css: "repeating-conic-gradient(#3a3a46 0% 25%, #2b2b33 0% 50%) 50%/14px 14px",
    draw: () => {},
  },
  {
    id: "solid",
    name: "단색",
    css: "#1e293b",
    draw: (ctx, w, h, solidColor) => {
      ctx.fillStyle = solidColor;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "sunset",
    name: "선셋",
    css: "linear-gradient(135deg,#ff9a9e,#fad0c4 45%,#ffd1a1)",
    draw: (ctx, w, h) => linear(ctx, w, h, [[0, "#ff9a9e"], [0.45, "#fad0c4"], [1, "#ffd1a1"]]),
  },
  {
    id: "ocean",
    name: "오션",
    css: "linear-gradient(135deg,#2e3192,#1bffff)",
    draw: (ctx, w, h) => linear(ctx, w, h, [[0, "#2e3192"], [1, "#1bffff"]]),
  },
  {
    id: "aurora",
    name: "오로라",
    css: "linear-gradient(135deg,#00c9ff,#92fe9d)",
    draw: (ctx, w, h) => linear(ctx, w, h, [[0, "#00c9ff"], [1, "#92fe9d"]]),
  },
  {
    id: "candy",
    name: "캔디",
    css: "linear-gradient(135deg,#fbc2eb,#a6c1ee)",
    draw: (ctx, w, h) => linear(ctx, w, h, [[0, "#fbc2eb"], [1, "#a6c1ee"]]),
  },
  {
    id: "peach",
    name: "피치",
    css: "linear-gradient(135deg,#ffecd2,#fcb69f)",
    draw: (ctx, w, h) => linear(ctx, w, h, [[0, "#ffecd2"], [1, "#fcb69f"]]),
  },
  {
    id: "midnight",
    name: "미드나잇",
    css: "linear-gradient(135deg,#232526,#414345)",
    draw: (ctx, w, h) => {
      linear(ctx, w, h, [[0, "#232526"], [1, "#414345"]]);
      glow(ctx, w, h, w * 0.2, h * 0.15, Math.max(w, h) * 0.6, "rgba(88,101,242,0.25)");
      glow(ctx, w, h, w * 0.85, h * 0.9, Math.max(w, h) * 0.55, "rgba(235,69,158,0.18)");
    },
  },
  {
    id: "forest",
    name: "포레스트",
    css: "linear-gradient(135deg,#134e5e,#71b280)",
    draw: (ctx, w, h) => linear(ctx, w, h, [[0, "#134e5e"], [1, "#71b280"]]),
  },
  {
    id: "mesh",
    name: "메시",
    css: "radial-gradient(at 20% 20%,#a18cd1 0,transparent 55%),radial-gradient(at 80% 30%,#fbc2eb 0,transparent 55%),radial-gradient(at 50% 90%,#8fd3f4 0,transparent 60%),#f5f7fa",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "#f5f7fa";
      ctx.fillRect(0, 0, w, h);
      const R = Math.max(w, h);
      glow(ctx, w, h, w * 0.2, h * 0.2, R * 0.6, "rgba(161,140,209,0.85)");
      glow(ctx, w, h, w * 0.8, h * 0.3, R * 0.55, "rgba(251,194,235,0.85)");
      glow(ctx, w, h, w * 0.5, h * 0.9, R * 0.6, "rgba(143,211,244,0.85)");
    },
  },
  {
    id: "grid",
    name: "그리드",
    css: "#0f172a",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(148,163,184,0.16)";
      const step = Math.max(24, Math.round(Math.min(w, h) / 24));
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = step / 2; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = step / 2; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      glow(ctx, w, h, w / 2, h / 2, Math.max(w, h) * 0.7, "rgba(56,189,248,0.12)");
    },
  },
  {
    id: "dots",
    name: "도트",
    css: "#fdfbf7",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "#fdfbf7";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(120,113,108,0.22)";
      const step = Math.max(18, Math.round(Math.min(w, h) / 30));
      const r = Math.max(1.5, step / 12);
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
];

export function getBackgroundPreset(id: string): BackgroundPreset {
  return BACKGROUND_PRESETS.find((p) => p.id === id) ?? BACKGROUND_PRESETS[0];
}

/**
 * "스마트 배경 필터" — 하나를 적용하면 배경/여백/비율/트림이 한 번에 세팅된다.
 * autoTrim 이 true 면 캡처 밖(창 밖) 균일 여백을 자동 제거한다.
 */
export interface SmartBackgroundFilter {
  id: string;
  name: string;
  description: string;
  autoTrim: boolean;
  options: Partial<BackgroundOptions>;
}

export const SMART_BACKGROUND_FILTERS: SmartBackgroundFilter[] = [
  {
    id: "smart-window",
    name: "🪟 창 캡처 정리",
    description: "창 밖 여백 자동 제거 + 그림자/모서리 보정",
    autoTrim: true,
    options: { preset: "midnight", padding: 0.07, radius: 0.018, shadow: 60, ratio: "auto" },
  },
  {
    id: "smart-presentation",
    name: "🖥️ 프레젠테이션",
    description: "16:9 자동 비율 + 차분한 그라데이션",
    autoTrim: true,
    options: { preset: "ocean", padding: 0.08, radius: 0.02, shadow: 50, ratio: "16:9" },
  },
  {
    id: "smart-insta",
    name: "📷 인스타 정방형",
    description: "1:1 자동 비율 + 밝은 메시 배경",
    autoTrim: true,
    options: { preset: "mesh", padding: 0.1, radius: 0.025, shadow: 40, ratio: "1:1" },
  },
  {
    id: "smart-story",
    name: "📱 스토리",
    description: "9:16 세로 비율 + 선셋 배경",
    autoTrim: true,
    options: { preset: "sunset", padding: 0.1, radius: 0.025, shadow: 40, ratio: "9:16" },
  },
  {
    id: "smart-doc",
    name: "📄 문서 첨부용",
    description: "여백 제거 + 4:3 + 도트 배경",
    autoTrim: true,
    options: { preset: "dots", padding: 0.06, radius: 0.012, shadow: 25, ratio: "4:3" },
  },
];
