import type { BackgroundOptions } from "./types";
import { FILTER_PRESETS } from "./filters";
import { SMART_BACKGROUND_FILTERS } from "./background";

/**
 * 룩(Look) — 필터 프리셋 + 배경/비율 + 자동 트림을 묶은 원클릭 콤보.
 * 카메라 화면에서 셔터를 누르기 전에 골라두면(촬영 모드) 매 샷에 자동 적용되고,
 * 사진이 이미 있으면 즉시 적용된다.
 */
export interface LookDef {
  id: string;
  emoji: string;
  name: string;
  /** FILTER_PRESETS 의 id */
  filterPresetId?: string;
  /** SMART_BACKGROUND_FILTERS 의 id (트림+배경+비율 일괄) */
  smartId?: string;
  /** smartId 대신/이후에 덮어쓸 배경 옵션 */
  bg?: Partial<BackgroundOptions>;
  autoTrim?: boolean;
}

export const RANDOM_LOOK_ID = "look-random";

export const LOOKS: LookDef[] = [
  { id: "look-none", emoji: "⭘", name: "없음" },
  { id: "look-window", emoji: "🪟", name: "창 정리", smartId: "smart-window" },
  {
    id: "look-presentation",
    emoji: "🖥️",
    name: "프레젠테이션",
    smartId: "smart-presentation",
    filterPresetId: "crisp",
  },
  { id: "look-insta", emoji: "📷", name: "인스타", smartId: "smart-insta", filterPresetId: "vivid" },
  {
    id: "look-cinema",
    emoji: "🎬",
    name: "시네마",
    filterPresetId: "cinema",
    autoTrim: true,
    bg: { preset: "midnight", padding: 0.08, radius: 0.02, shadow: 55, ratio: "16:9" },
  },
  {
    id: "look-mood",
    emoji: "🌅",
    name: "감성",
    filterPresetId: "vintage",
    autoTrim: true,
    bg: { preset: "sunset", padding: 0.09, radius: 0.025, shadow: 40, ratio: "auto" },
  },
  {
    id: "look-dark",
    emoji: "🌙",
    name: "다크",
    filterPresetId: "dark",
    autoTrim: true,
    bg: { preset: "grid", padding: 0.08, radius: 0.02, shadow: 60, ratio: "16:9" },
  },
  { id: "look-doc", emoji: "📄", name: "문서", smartId: "smart-doc", filterPresetId: "crisp" },
  { id: RANDOM_LOOK_ID, emoji: "🎲", name: "랜덤" },
];

export function getLook(id: string): LookDef | null {
  return LOOKS.find((l) => l.id === id) ?? null;
}

/** 🎲 랜덤 룩: '없음'/'랜덤' 을 제외한 룩 중 하나 (rand 주입 가능 — 테스트용) */
export function pickRandomLook(rand: () => number = Math.random): LookDef {
  const pool = LOOKS.filter((l) => l.id !== "look-none" && l.id !== RANDOM_LOOK_ID);
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

/** 정의 무결성 검사용 — 참조하는 프리셋 id 가 실제 존재하는지 */
export function validateLooks(): string[] {
  const filterIds = new Set(FILTER_PRESETS.map((p) => p.id));
  const smartIds = new Set(SMART_BACKGROUND_FILTERS.map((s) => s.id));
  const problems: string[] = [];
  for (const look of LOOKS) {
    if (look.filterPresetId && !filterIds.has(look.filterPresetId)) {
      problems.push(`${look.id}: 필터 프리셋 없음 (${look.filterPresetId})`);
    }
    if (look.smartId && !smartIds.has(look.smartId)) {
      problems.push(`${look.id}: 스마트 배경 없음 (${look.smartId})`);
    }
  }
  return problems;
}
