import type { FilterParams, RawImage } from "./types";

export function defaultFilterParams(): FilterParams {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    sharpen: 0,
    blur: 0,
    vignette: 0,
    grain: 0,
    sepia: 0,
    grayscale: false,
    invert: false,
  };
}

export function isNeutral(p: FilterParams): boolean {
  const d = defaultFilterParams();
  return (Object.keys(d) as (keyof FilterParams)[]).every((k) => p[k] === d[k]);
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function clampFilterParams(p: FilterParams): FilterParams {
  return {
    brightness: clamp(p.brightness, -100, 100),
    contrast: clamp(p.contrast, -100, 100),
    saturation: clamp(p.saturation, -100, 100),
    temperature: clamp(p.temperature, -100, 100),
    tint: clamp(p.tint, -100, 100),
    sharpen: clamp(p.sharpen, 0, 100),
    blur: clamp(p.blur, 0, 100),
    vignette: clamp(p.vignette, 0, 100),
    grain: clamp(p.grain, 0, 100),
    sepia: clamp(p.sepia, 0, 100),
    grayscale: !!p.grayscale,
    invert: !!p.invert,
  };
}

/** 결정적 PRNG — 그레인 노이즈가 렌더링마다 흔들리지 않게 함 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function separableBoxBlur(img: RawImage, radius: number): RawImage {
  if (radius < 1) return img;
  const { width: w, height: h } = img;
  const src = img.data;
  const tmp = new Uint8ClampedArray(src.length);
  const dst = new Uint8ClampedArray(src.length);
  const win = radius * 2 + 1;

  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let r = 0, g = 0, b = 0, a = 0;
    for (let x = -radius; x <= radius; x++) {
      const i = (row + clamp(x, 0, w - 1)) * 4;
      r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
    }
    for (let x = 0; x < w; x++) {
      const o = (row + x) * 4;
      tmp[o] = r / win; tmp[o + 1] = g / win; tmp[o + 2] = b / win; tmp[o + 3] = a / win;
      const iAdd = (row + clamp(x + radius + 1, 0, w - 1)) * 4;
      const iSub = (row + clamp(x - radius, 0, w - 1)) * 4;
      r += src[iAdd] - src[iSub];
      g += src[iAdd + 1] - src[iSub + 1];
      b += src[iAdd + 2] - src[iSub + 2];
      a += src[iAdd + 3] - src[iSub + 3];
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let y = -radius; y <= radius; y++) {
      const i = (clamp(y, 0, h - 1) * w + x) * 4;
      r += tmp[i]; g += tmp[i + 1]; b += tmp[i + 2]; a += tmp[i + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      dst[o] = r / win; dst[o + 1] = g / win; dst[o + 2] = b / win; dst[o + 3] = a / win;
      const iAdd = (clamp(y + radius + 1, 0, h - 1) * w + x) * 4;
      const iSub = (clamp(y - radius, 0, h - 1) * w + x) * 4;
      r += tmp[iAdd] - tmp[iSub];
      g += tmp[iAdd + 1] - tmp[iSub + 1];
      b += tmp[iAdd + 2] - tmp[iSub + 2];
      a += tmp[iAdd + 3] - tmp[iSub + 3];
    }
  }
  return { width: w, height: h, data: dst };
}

function sharpenConvolve(img: RawImage, amount: number): RawImage {
  if (amount <= 0) return img;
  const k = (amount / 100) * 0.9;
  const { width: w, height: h } = img;
  const src = img.data;
  const dst = new Uint8ClampedArray(src.length);
  const center = 1 + 4 * k;
  for (let y = 0; y < h; y++) {
    const up = clamp(y - 1, 0, h - 1) * w;
    const down = clamp(y + 1, 0, h - 1) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const left = clamp(x - 1, 0, w - 1);
      const right = clamp(x + 1, 0, w - 1);
      const o = (row + x) * 4;
      for (let c = 0; c < 3; c++) {
        dst[o + c] =
          src[o + c] * center -
          k *
            (src[(up + x) * 4 + c] +
              src[(down + x) * 4 + c] +
              src[(row + left) * 4 + c] +
              src[(row + right) * 4 + c]);
      }
      dst[o + 3] = src[o + 3];
    }
  }
  return { width: w, height: h, data: dst };
}

/**
 * 전체 필터 파이프라인 적용. 입력은 변경하지 않고 새 RawImage 를 반환한다.
 * 순서: 블러 → 샤픈 → 픽셀 단위 색 보정 → 비네트 → 그레인
 */
export function applyFilters(img: RawImage, params: FilterParams): RawImage {
  const p = clampFilterParams(params);
  let out: RawImage = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };

  const blurRadius = Math.round((p.blur / 100) * 8);
  if (blurRadius > 0) out = separableBoxBlur(out, blurRadius);
  if (p.sharpen > 0) out = sharpenConvolve(out, p.sharpen);

  const { width: w, height: h, data } = out;
  const brightMul = 1 + p.brightness / 100;
  const c = p.contrast * 1.27;
  const contrastMul = (259 * (c + 255)) / (255 * (259 - c));
  const satMul = 1 + p.saturation / 100;
  const tempShift = p.temperature * 0.6;
  const tintShift = p.tint * 0.6;
  const sepiaAmt = p.sepia / 100;

  const anyColorOp =
    p.brightness !== 0 || p.contrast !== 0 || p.saturation !== 0 || p.temperature !== 0 ||
    p.tint !== 0 || p.sepia !== 0 || p.grayscale || p.invert;

  if (anyColorOp) {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];

      if (p.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }

      r *= brightMul; g *= brightMul; b *= brightMul;

      r = contrastMul * (r - 128) + 128;
      g = contrastMul * (g - 128) + 128;
      b = contrastMul * (b - 128) + 128;

      r += tempShift; b -= tempShift;
      g -= tintShift;

      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (p.grayscale) {
        r = g = b = luma;
      } else if (p.saturation !== 0) {
        r = luma + (r - luma) * satMul;
        g = luma + (g - luma) * satMul;
        b = luma + (b - luma) * satMul;
      }

      if (sepiaAmt > 0) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = r + (sr - r) * sepiaAmt;
        g = g + (sg - g) * sepiaAmt;
        b = b + (sb - b) * sepiaAmt;
      }

      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
  }

  if (p.vignette > 0) {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const maxD = Math.sqrt(cx * cx + cy * cy) || 1;
    const strength = p.vignette / 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / maxD; // 0..1
        // 중심 55% 까지는 유지, 가장자리로 갈수록 어둡게
        const t = clamp((d - 0.55) / 0.45, 0, 1);
        const mul = 1 - strength * t * t;
        if (mul < 1) {
          const o = (y * w + x) * 4;
          data[o] *= mul; data[o + 1] *= mul; data[o + 2] *= mul;
        }
      }
    }
  }

  if (p.grain > 0) {
    const rand = mulberry32(1234);
    const amp = (p.grain / 100) * 28;
    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() - 0.5) * 2 * amp;
      data[i] += n; data[i + 1] += n; data[i + 2] += n;
    }
  }

  return out;
}

export interface FilterPreset {
  id: string;
  name: string;
  params: Partial<FilterParams>;
}

/** 일반(로컬) 필터 프리셋 */
export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", name: "원본", params: {} },
  { id: "crisp", name: "선명하게", params: { sharpen: 45, contrast: 12, saturation: 8 } },
  { id: "soft", name: "부드럽게", params: { blur: 12, brightness: 6, contrast: -8 } },
  { id: "warm", name: "따뜻하게", params: { temperature: 35, brightness: 5, saturation: 10 } },
  { id: "cool", name: "차갑게", params: { temperature: -35, contrast: 6 } },
  { id: "mono", name: "흑백", params: { grayscale: true, contrast: 15 } },
  { id: "sepia", name: "세피아", params: { sepia: 80, contrast: 5, vignette: 20 } },
  { id: "vintage", name: "빈티지", params: { sepia: 35, grain: 30, vignette: 35, contrast: -6, temperature: 15 } },
  { id: "cinema", name: "시네마", params: { contrast: 18, saturation: -12, temperature: -10, vignette: 30 } },
  { id: "vivid", name: "쨍하게", params: { saturation: 40, contrast: 15, sharpen: 25 } },
  { id: "dark", name: "다크 무드", params: { brightness: -18, contrast: 20, vignette: 45, saturation: -8 } },
  { id: "negative", name: "네거티브", params: { invert: true } },
];

export function presetToParams(preset: FilterPreset): FilterParams {
  return { ...defaultFilterParams(), ...preset.params };
}
