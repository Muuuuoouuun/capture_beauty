import type { BackgroundOptions, FilterParams, Stamp, StampKind, StampStyle } from "./types";
import { clampFilterParams, defaultFilterParams } from "./filters";
import { defaultBackgroundOptions } from "./background";

/**
 * 캡처 프로파일 — 현재 편집 상태(필터·배경/비율·스탬프·출력 크기)를 통째로 저장한
 * "나만의 촬영 세팅". 촬영 모드로 선택해두면 셔터마다 같은 결과물이 나온다.
 * AI 필터가 적용된 상태를 저장하면 그 보정 결과값이 그대로 담긴다 (재호출 비용 없음).
 */
export interface CaptureProfile {
  id: string;
  name: string;
  emoji: string;
  filters: FilterParams;
  bg: BackgroundOptions;
  stamps: Stamp[];
  /** 내보내기 가로 크기 (px). 0 = 원본 크기 */
  outputWidth: number;
  createdAt: number;
}

export const MAX_PROFILES = 12;
export const LAST_PROFILE_ID = "profile:last";
export const PROFILE_EMOJIS = ["📦", "🎯", "🧰", "🗂️", "🏷️", "📐", "🖼️", "🎞️", "📸", "🧲", "🪄", "🎪"];

let profileSeq = 0;

export function createProfileId(now: number = Date.now()): string {
  return `profile:${now.toString(36)}-${profileSeq++}`;
}

export interface ProfileSource {
  filters: FilterParams;
  bg: BackgroundOptions;
  stamps: Stamp[];
  outputWidth: number;
}

/** 현재 상태 스냅샷 → 프로파일 (상태와 분리된 깊은 복사) */
export function buildProfile(
  name: string,
  source: ProfileSource,
  opts: { id?: string; emoji?: string; now?: number } = {},
): CaptureProfile {
  const now = opts.now ?? Date.now();
  return {
    id: opts.id ?? createProfileId(now),
    name: name.trim() || "내 프리셋",
    emoji: opts.emoji ?? PROFILE_EMOJIS[Math.abs(hashCode(name)) % PROFILE_EMOJIS.length],
    filters: { ...source.filters },
    bg: { ...source.bg },
    stamps: source.stamps.map((s) => ({ ...s })),
    outputWidth: clampOutputWidth(source.outputWidth),
    createdAt: now,
  };
}

let cloneSeq = 0;

/** 적용용 스탬프 사본 — 새 id 를 부여해 상태 간 참조 공유를 막는다 */
export function cloneProfileStamps(profile: CaptureProfile): Stamp[] {
  return profile.stamps.map((s, i) => ({
    ...s,
    id: `stamp-${profile.id}-${cloneSeq++}-${i}`,
  }));
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function clampOutputWidth(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  return Math.round(Math.max(160, Math.min(8000, v)));
}

/* ---------- 저장/복원 검증 ---------- */

const STAMP_KINDS = new Set<StampKind>(["datetime", "text", "emoji"]);
const STAMP_STYLES = new Set<StampStyle>(["plain", "badge", "seal", "outline", "ribbon"]);

const num = (v: unknown, fb: number, lo: number, hi: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fb;
const str = (v: unknown, fb: string): string => (typeof v === "string" && v.trim() ? v : fb);

function normalizeStamp(raw: unknown, fallbackId: string): Stamp | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const kind = STAMP_KINDS.has(o.kind as StampKind) ? (o.kind as StampKind) : null;
  if (!kind || typeof o.text !== "string") return null;
  return {
    id: str(o.id, fallbackId),
    kind,
    text: o.text,
    style: STAMP_STYLES.has(o.style as StampStyle) ? (o.style as StampStyle) : "plain",
    color: str(o.color, "#ffb020"),
    x: num(o.x, 0.5, -0.2, 1.2),
    y: num(o.y, 0.5, -0.2, 1.2),
    size: num(o.size, 0.045, 0.005, 0.6),
    rotation: num(o.rotation, 0, -360, 360),
    opacity: num(o.opacity, 1, 0.02, 1),
  };
}

function normalizeBg(raw: unknown): BackgroundOptions {
  const d = defaultBackgroundOptions();
  if (typeof raw !== "object" || raw === null) return d;
  const o = raw as Record<string, unknown>;
  return {
    preset: str(o.preset, d.preset),
    solidColor: str(o.solidColor, d.solidColor),
    padding: num(o.padding, d.padding, 0, 0.5),
    radius: num(o.radius, d.radius, 0, 0.2),
    shadow: num(o.shadow, d.shadow, 0, 100),
    ratio: str(o.ratio, d.ratio),
  };
}

function normalizeFilters(raw: unknown): FilterParams {
  const d = defaultFilterParams();
  if (typeof raw !== "object" || raw === null) return d;
  const o = raw as Record<string, unknown>;
  // 숫자가 아닌 값은 기본값으로 — clampFilterParams 는 숫자 전제라 여기서 걸러준다
  const cleaned: FilterParams = { ...d };
  for (const key of Object.keys(d) as (keyof FilterParams)[]) {
    const v = o[key];
    if (typeof d[key] === "boolean") {
      (cleaned[key] as boolean) = typeof v === "boolean" ? v : (d[key] as boolean);
    } else if (typeof v === "number" && Number.isFinite(v)) {
      (cleaned[key] as number) = v;
    }
  }
  return clampFilterParams(cleaned);
}

/** 저장된 값(unknown) → 유효한 프로파일. 복구 불가면 null */
export function normalizeProfile(raw: unknown): CaptureProfile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const stamps = Array.isArray(o.stamps)
    ? o.stamps
        .map((s, i) => normalizeStamp(s, `${o.id}-s${i}`))
        .filter((s): s is Stamp => s !== null)
    : [];
  return {
    id: o.id,
    name: o.name.trim() || "내 프리셋",
    emoji: str(o.emoji, "📦"),
    filters: normalizeFilters(o.filters),
    bg: normalizeBg(o.bg),
    stamps,
    outputWidth: clampOutputWidth(o.outputWidth),
    createdAt: num(o.createdAt, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function normalizeProfiles(raw: unknown): CaptureProfile[] {
  if (!Array.isArray(raw)) return [];
  const out: CaptureProfile[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const p = normalizeProfile(item);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
    if (out.length >= MAX_PROFILES) break;
  }
  return out;
}
