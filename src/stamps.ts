import type { Stamp, StampKind, StampStyle } from "./types";

let stampSeq = 0;

/** 'YYYY-MM-DD HH:mm' 같은 형식 문자열을 실제 날짜로 치환 */
export function formatDateStamp(format: string, date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const weekdaysKo = ["일", "월", "화", "수", "목", "금", "토"];
  return format
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/YY/g, pad(date.getFullYear() % 100))
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()))
    .replace(/ddd/g, weekdaysKo[date.getDay()]);
}

export const DATE_FORMATS = [
  { id: "YYYY-MM-DD", label: "2026-08-24" },
  { id: "YYYY-MM-DD HH:mm", label: "2026-08-24 14:30" },
  { id: "YYYY.MM.DD (ddd)", label: "2026.08.24 (월)" },
  { id: "YYYY년 MM월 DD일", label: "2026년 08월 24일" },
  { id: "HH:mm:ss", label: "14:30:05" },
];

export function createStamp(kind: StampKind, overrides: Partial<Stamp> = {}): Stamp {
  const base: Stamp = {
    id: `stamp-${Date.now().toString(36)}-${stampSeq++}`,
    kind,
    text: kind === "datetime" ? "YYYY-MM-DD HH:mm" : kind === "emoji" ? "⭐" : "텍스트",
    style: "plain",
    color: "#ffb020",
    x: 0.82,
    y: 0.92,
    size: 0.045,
    rotation: 0,
    opacity: 1,
  };
  return { ...base, ...overrides };
}

/** 스탬프에 실제로 그려질 문자열 */
export function stampDisplayText(stamp: Stamp, now: Date = new Date()): string {
  return stamp.kind === "datetime" ? formatDateStamp(stamp.text, now) : stamp.text;
}

export interface StampPreset {
  id: string;
  name: string;
  make: () => Stamp;
}

/** 원클릭 스탬프 프리셋 */
export const STAMP_PRESETS: StampPreset[] = [
  {
    id: "date",
    name: "📅 날짜",
    make: () => createStamp("datetime", { text: "YYYY-MM-DD", x: 0.84, y: 0.93 }),
  },
  {
    id: "datetime",
    name: "⏰ 날짜+시간",
    make: () => createStamp("datetime", { text: "YYYY-MM-DD HH:mm", x: 0.8, y: 0.93 }),
  },
  {
    id: "seal-approve",
    name: "🔴 승인 도장",
    make: () =>
      createStamp("text", {
        text: "승인", style: "seal", color: "#e5484d",
        x: 0.88, y: 0.14, size: 0.11, rotation: -12, opacity: 0.9,
      }),
  },
  {
    id: "seal-check",
    name: "✔️ 확인 도장",
    make: () =>
      createStamp("text", {
        text: "확인", style: "seal", color: "#2f6fed",
        x: 0.88, y: 0.14, size: 0.11, rotation: 8, opacity: 0.9,
      }),
  },
  {
    id: "badge-confidential",
    name: "🏷️ 대외비",
    make: () =>
      createStamp("text", {
        text: "대외비", style: "badge", color: "#e5484d",
        x: 0.5, y: 0.08, size: 0.05,
      }),
  },
  {
    id: "badge-draft",
    name: "📝 DRAFT",
    make: () =>
      createStamp("text", {
        text: "DRAFT", style: "outline", color: "#94a3b8",
        x: 0.5, y: 0.5, size: 0.16, rotation: -22, opacity: 0.45,
      }),
  },
  {
    id: "emoji-star",
    name: "⭐ 이모지",
    make: () => createStamp("emoji", { text: "⭐", x: 0.1, y: 0.1, size: 0.09 }),
  },
  {
    id: "custom-text",
    name: "✏️ 텍스트",
    make: () => createStamp("text", { text: "메모", style: "badge", color: "#0f172a", x: 0.5, y: 0.85 }),
  },
];

export interface StampBounds {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * 스탬프를 ctx 에 그린다. (imgX, imgY) 는 출력 캔버스 안에서 이미지가 놓인 오프셋.
 * 반환값은 히트테스트용 경계(출력 캔버스 좌표, 회전 미적용 AABB 근사).
 */
export function drawStamp(
  ctx: CanvasRenderingContext2D,
  stamp: Stamp,
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
  now: Date = new Date(),
): StampBounds {
  const text = stampDisplayText(stamp, now);
  const short = Math.min(imgW, imgH);
  const fontSize = Math.max(8, stamp.size * short);
  const cx = imgX + stamp.x * imgW;
  const cy = imgY + stamp.y * imgH;

  ctx.save();
  ctx.globalAlpha = stamp.opacity;
  ctx.translate(cx, cy);
  ctx.rotate((stamp.rotation * Math.PI) / 180);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontFamily =
    stamp.kind === "datetime"
      ? "'Courier New', monospace"
      : "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.font = `${stamp.style === "seal" ? "900" : "700"} ${fontSize}px ${fontFamily}`;

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  let boundsW = textW;
  let boundsH = fontSize * 1.2;

  switch (stamp.style) {
    case "seal": {
      // 원형 도장: 이중 링 + 텍스트, 살짝 거친 질감의 반투명 잉크 느낌
      const r = Math.max(textW / 2 + fontSize * 0.55, fontSize * 0.95);
      ctx.strokeStyle = stamp.color;
      ctx.lineWidth = Math.max(2, fontSize * 0.09);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, fontSize * 0.035);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = stamp.color;
      // 원 안에 맞게 텍스트 축소
      const maxTextW = r * 1.5;
      if (textW > maxTextW) {
        const scale = maxTextW / textW;
        ctx.save();
        ctx.scale(scale, scale);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(text, 0, 0);
      }
      boundsW = boundsH = r * 2;
      break;
    }
    case "badge": {
      const padX = fontSize * 0.6;
      const padY = fontSize * 0.32;
      const w = textW + padX * 2;
      const h = fontSize + padY * 2;
      const rr = h / 2.6;
      ctx.fillStyle = stamp.color;
      roundRectPath(ctx, -w / 2, -h / 2, w, h, rr);
      ctx.fill();
      ctx.fillStyle = idealTextOn(stamp.color);
      ctx.fillText(text, 0, fontSize * 0.04);
      boundsW = w;
      boundsH = h;
      break;
    }
    case "outline": {
      ctx.lineWidth = Math.max(1.5, fontSize * 0.06);
      ctx.strokeStyle = stamp.color;
      ctx.strokeText(text, 0, 0);
      break;
    }
    case "ribbon": {
      const padX = fontSize * 0.7;
      const padY = fontSize * 0.3;
      const w = textW + padX * 2;
      const h = fontSize + padY * 2;
      const notch = h * 0.45;
      ctx.fillStyle = stamp.color;
      ctx.beginPath();
      ctx.moveTo(-w / 2 - notch, -h / 2);
      ctx.lineTo(w / 2 + notch, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 + notch, h / 2);
      ctx.lineTo(-w / 2 - notch, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = idealTextOn(stamp.color);
      ctx.fillText(text, 0, fontSize * 0.04);
      boundsW = w + notch * 2;
      boundsH = h;
      break;
    }
    default: {
      // plain: 타임스탬프 카메라 느낌 — 어두운 외곽선 + 본색
      ctx.lineWidth = Math.max(2, fontSize * 0.12);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = stamp.color;
      ctx.fillText(text, 0, 0);
    }
  }

  ctx.restore();
  return { cx, cy, w: Math.max(boundsW, fontSize) * 1.1, h: Math.max(boundsH, fontSize) * 1.1 };
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

/** 배경색 밝기에 따라 검정/흰 텍스트 선택 */
export function idealTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 150 ? "#111111" : "#ffffff";
}

export const STAMP_STYLE_NAMES: Record<StampStyle, string> = {
  plain: "기본",
  badge: "배지",
  seal: "도장",
  outline: "외곽선",
  ribbon: "리본",
};

export const STAMP_EMOJIS = ["⭐", "✅", "❤️", "🔥", "👍", "🎉", "📌", "⚠️", "💡", "🔒"];
