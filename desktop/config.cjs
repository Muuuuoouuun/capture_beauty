/**
 * 데스크톱 래퍼 공용 설정 로직 (순수 함수 — 단위 테스트 대상).
 * Electron accelerator 문자열 검증과 전역 단축키 설정 정규화.
 */

const DEFAULT_GLOBAL_SHORTCUTS = Object.freeze({
  /** 창 안 띄우고 즉시 캡처 → 퀵 동작(복사 등)만 수행 */
  quick: "CommandOrControl+Shift+1",
  /** 캡처 후 편집 창 표시 */
  edit: "CommandOrControl+Shift+2",
});

const MODIFIERS = new Set([
  "command", "cmd", "control", "ctrl", "commandorcontrol", "cmdorctrl",
  "alt", "option", "altgr", "shift", "super", "meta",
]);

/**
 * Electron accelerator 형식의 느슨한 검증.
 * "Modifier+...+Key" — 마지막 토큰은 수식키가 아니어야 하고, 토큰은 비어있으면 안 된다.
 */
function isValidAccelerator(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  const parts = value.split("+");
  if (parts.some((p) => p.trim() === "" || /\s/.test(p))) return false;
  const last = parts[parts.length - 1].toLowerCase();
  if (MODIFIERS.has(last)) return false;
  // 마지막 키 외 토큰은 모두 수식키여야 한다
  for (const part of parts.slice(0, -1)) {
    if (!MODIFIERS.has(part.toLowerCase())) return false;
  }
  return true;
}

/** 저장값(unknown) → 안전한 전역 단축키 설정 */
function normalizeGlobalShortcuts(raw) {
  const out = { ...DEFAULT_GLOBAL_SHORTCUTS };
  if (typeof raw !== "object" || raw === null) return out;
  for (const key of ["quick", "edit"]) {
    const v = raw[key];
    if (isValidAccelerator(v)) out[key] = v;
  }
  // 두 동작이 같은 키를 가지면 기본값으로 복구
  if (out.quick === out.edit) return { ...DEFAULT_GLOBAL_SHORTCUTS };
  return out;
}

module.exports = { DEFAULT_GLOBAL_SHORTCUTS, isValidAccelerator, normalizeGlobalShortcuts };
