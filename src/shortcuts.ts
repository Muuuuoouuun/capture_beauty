import type { KeyCombo } from "./types";

export type ActionId =
  | "capture-screen"
  | "toggle-session"
  | "toggle-widget"
  | "open-file"
  | "paste-clipboard"
  | "export-image"
  | "copy-image"
  | "undo"
  | "reset-edits"
  | "toggle-editor"
  | "ai-enhance"
  | "stamp-date"
  | "stamp-seal"
  | "cycle-ratio"
  | "auto-trim"
  | "tab-filters"
  | "tab-ai"
  | "tab-stamps"
  | "tab-background"
  | "tab-settings";

export interface ActionDef {
  id: ActionId;
  label: string;
}

export const ACTIONS: ActionDef[] = [
  { id: "capture-screen", label: "화면 캡처 (셔터)" },
  { id: "toggle-session", label: "연속 캡처 연결/해제" },
  { id: "toggle-widget", label: "캡처 위젯 열기/닫기" },
  { id: "open-file", label: "이미지 열기" },
  { id: "paste-clipboard", label: "클립보드 붙여넣기" },
  { id: "export-image", label: "이미지 저장" },
  { id: "copy-image", label: "이미지 복사" },
  { id: "undo", label: "실행 취소" },
  { id: "reset-edits", label: "편집 초기화" },
  { id: "toggle-editor", label: "편집 창 열기/닫기" },
  { id: "ai-enhance", label: "AI 자동 보정" },
  { id: "stamp-date", label: "날짜 스탬프 추가" },
  { id: "stamp-seal", label: "도장 스탬프 추가" },
  { id: "cycle-ratio", label: "비율 순환" },
  { id: "auto-trim", label: "자동 여백 제거" },
  { id: "tab-filters", label: "필터 탭" },
  { id: "tab-ai", label: "AI 탭" },
  { id: "tab-stamps", label: "스탬프 탭" },
  { id: "tab-background", label: "배경 탭" },
  { id: "tab-settings", label: "설정 탭" },
];

const combo = (key: string, mods: Partial<KeyCombo> = {}): KeyCombo => ({
  key,
  ctrl: false,
  shift: false,
  alt: false,
  meta: false,
  ...mods,
});

export function defaultShortcuts(): Record<ActionId, KeyCombo | null> {
  return {
    "capture-screen": combo("s", { ctrl: true, shift: true }),
    "toggle-session": combo("c"),
    "toggle-widget": combo("p"),
    "open-file": combo("o", { ctrl: true }),
    "paste-clipboard": combo("v", { ctrl: true }),
    "export-image": combo("e", { ctrl: true }),
    "copy-image": combo("c", { ctrl: true, shift: true }),
    undo: combo("z", { ctrl: true }),
    "reset-edits": combo("x", { shift: true }),
    "toggle-editor": combo("e"),
    "ai-enhance": combo("a"),
    "stamp-date": combo("t"),
    "stamp-seal": combo("d"),
    "cycle-ratio": combo("r"),
    "auto-trim": combo("w"),
    "tab-filters": combo("1"),
    "tab-ai": combo("2"),
    "tab-stamps": combo("3"),
    "tab-background": combo("4"),
    "tab-settings": combo("5"),
  };
}

/** 수식키 단독 입력은 null (조합 대기 상태) */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock"]);

export function comboFromEvent(e: KeyEventLike): KeyCombo | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  let key = e.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toLowerCase();
  return { key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };
}

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  Delete: "Del",
};

export function formatCombo(c: KeyCombo | null): string {
  if (!c) return "없음";
  const parts: string[] = [];
  if (c.ctrl) parts.push("Ctrl");
  if (c.alt) parts.push("Alt");
  if (c.shift) parts.push("Shift");
  if (c.meta) parts.push("Meta");
  const label = KEY_LABELS[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  parts.push(label);
  return parts.join("+");
}

export function combosEqual(a: KeyCombo | null, b: KeyCombo | null): boolean {
  if (!a || !b) return false;
  return (
    a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.meta === b.meta
  );
}

export interface AssignResult {
  ok: boolean;
  /** 다른 액션에서 이 조합을 가져온 경우 그 액션 id */
  stolenFrom: ActionId | null;
  reason?: string;
}

/** 브라우저가 preventDefault 를 허용하지 않는 예약 조합 */
const FORBIDDEN: KeyCombo[] = [
  combo("w", { ctrl: true }),
  combo("t", { ctrl: true }),
  combo("n", { ctrl: true }),
  combo("q", { meta: true }),
];

export type ShortcutMap = Record<ActionId, KeyCombo | null>;

export class ShortcutManager {
  private map: ShortcutMap;
  private handlers: Partial<Record<ActionId, () => void>> = {};
  /** 녹화 결과 콜백 — Esc 취소 시 null 전달 */
  private recordingCallback: ((c: KeyCombo | null) => void) | null = null;
  onChange: ((map: ShortcutMap) => void) | null = null;

  constructor(initial?: Partial<ShortcutMap>) {
    this.map = { ...defaultShortcuts(), ...(initial ?? {}) };
  }

  getMap(): ShortcutMap {
    return { ...this.map };
  }

  getCombo(id: ActionId): KeyCombo | null {
    return this.map[id] ?? null;
  }

  on(id: ActionId, fn: () => void): void {
    this.handlers[id] = fn;
  }

  /**
   * 조합 할당. 이미 다른 액션이 쓰고 있으면 그 액션에서 떼어와 이 액션에 준다
   * (설정을 "편하게" — 거부 대신 자동 이관하고 결과를 알려줌).
   */
  assign(id: ActionId, c: KeyCombo): AssignResult {
    if (FORBIDDEN.some((f) => combosEqual(f, c))) {
      return { ok: false, stolenFrom: null, reason: "브라우저 예약 단축키입니다" };
    }
    let stolenFrom: ActionId | null = null;
    for (const [otherId, other] of Object.entries(this.map) as [ActionId, KeyCombo | null][]) {
      if (otherId !== id && combosEqual(other, c)) {
        this.map[otherId] = null;
        stolenFrom = otherId;
      }
    }
    this.map[id] = c;
    this.onChange?.(this.getMap());
    return { ok: true, stolenFrom };
  }

  clear(id: ActionId): void {
    this.map[id] = null;
    this.onChange?.(this.getMap());
  }

  resetAll(): void {
    this.map = defaultShortcuts();
    this.onChange?.(this.getMap());
  }

  /** 다음 keydown 한 번을 녹화 (Esc 면 null). 반환된 함수로 취소 가능 */
  startRecording(cb: (c: KeyCombo | null) => void): () => void {
    this.recordingCallback = cb;
    return () => {
      if (this.recordingCallback === cb) this.recordingCallback = null;
    };
  }

  get isRecording(): boolean {
    return this.recordingCallback !== null;
  }

  /**
   * keydown 처리. 처리했으면 true (호출측에서 preventDefault).
   * targetEditable: 입력 필드에 포커스가 있으면 수식키 없는 단축키는 무시.
   */
  handleKeydown(e: KeyEventLike, targetEditable = false): { handled: boolean; action: ActionId | null } {
    const c = comboFromEvent(e);
    if (!c) return { handled: false, action: null };

    if (this.recordingCallback) {
      const cb = this.recordingCallback;
      this.recordingCallback = null;
      cb(c.key === "Escape" ? null : c);
      return { handled: true, action: null };
    }

    if (targetEditable && !c.ctrl && !c.meta && !c.alt) return { handled: false, action: null };

    for (const [id, assigned] of Object.entries(this.map) as [ActionId, KeyCombo | null][]) {
      if (combosEqual(assigned, c)) {
        const fn = this.handlers[id];
        if (fn) {
          fn();
          return { handled: true, action: id };
        }
        return { handled: false, action: id };
      }
    }
    return { handled: false, action: null };
  }
}

/* ---------- 저장/복원 ---------- */

export function serializeShortcuts(map: ShortcutMap): string {
  return JSON.stringify(map);
}

export function parseShortcuts(json: string | null): Partial<ShortcutMap> | null {
  if (!json) return null;
  try {
    return parseShortcutsValue(JSON.parse(json));
  } catch {
    return null;
  }
}

/** 이미 역직렬화된 값(unknown) 검증 */
export function parseShortcutsValue(raw: unknown): Partial<ShortcutMap> | null {
  {
    if (typeof raw !== "object" || raw === null) return null;
    const out: Partial<ShortcutMap> = {};
    const validIds = new Set(ACTIONS.map((a) => a.id as string));
    for (const [k, v] of Object.entries(raw)) {
      if (!validIds.has(k)) continue;
      if (v === null) {
        out[k as ActionId] = null;
        continue;
      }
      const c = v as Record<string, unknown>;
      if (typeof c.key === "string") {
        out[k as ActionId] = {
          key: c.key,
          ctrl: !!c.ctrl,
          shift: !!c.shift,
          alt: !!c.alt,
          meta: !!c.meta,
        };
      }
    }
    return out;
  }
}
