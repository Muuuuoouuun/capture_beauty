import { describe, expect, it, vi } from "vitest";
import {
  ACTION_GROUPS,
  ACTIONS,
  comboFromEvent,
  combosEqual,
  defaultShortcuts,
  formatCombo,
  parseShortcuts,
  parseShortcutsValue,
  serializeShortcuts,
  ShortcutManager,
} from "../src/shortcuts";
import type { KeyCombo } from "../src/types";

const ev = (key: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  metaKey: !!mods.meta,
});

describe("comboFromEvent", () => {
  it("수식키 단독 입력은 null", () => {
    expect(comboFromEvent(ev("Control", { ctrl: true }))).toBeNull();
    expect(comboFromEvent(ev("Shift", { shift: true }))).toBeNull();
  });

  it("문자는 소문자로 정규화한다", () => {
    const c = comboFromEvent(ev("S", { ctrl: true, shift: true }))!;
    expect(c.key).toBe("s");
    expect(c.ctrl).toBe(true);
    expect(c.shift).toBe(true);
  });

  it("스페이스는 'Space' 로 표기한다", () => {
    expect(comboFromEvent(ev(" "))!.key).toBe("Space");
  });
});

describe("formatCombo", () => {
  it("Ctrl+Shift+S 형태로 표기한다", () => {
    expect(formatCombo(comboFromEvent(ev("s", { ctrl: true, shift: true })))).toBe("Ctrl+Shift+S");
  });
  it("특수키 라벨을 치환한다", () => {
    expect(formatCombo(comboFromEvent(ev("ArrowLeft")))).toBe("←");
  });
  it("null 은 '없음'", () => {
    expect(formatCombo(null)).toBe("없음");
  });
});

describe("ShortcutManager", () => {
  it("기본 단축키로 액션을 실행한다", () => {
    const m = new ShortcutManager();
    const fn = vi.fn();
    m.on("capture-screen", fn);
    const res = m.handleKeydown(ev("s", { ctrl: true, shift: true }));
    expect(res.handled).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("입력 필드에서는 수식키 없는 단축키를 무시한다", () => {
    const m = new ShortcutManager();
    const fn = vi.fn();
    m.on("ai-enhance", fn); // 기본값: A (수식키 없음)
    expect(m.handleKeydown(ev("a"), true).handled).toBe(false);
    expect(fn).not.toHaveBeenCalled();
    // 수식키 있는 조합은 입력 필드에서도 동작
    const fn2 = vi.fn();
    m.on("export-image", fn2); // Ctrl+E
    expect(m.handleKeydown(ev("e", { ctrl: true }), true).handled).toBe(true);
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("assign 은 다른 액션이 쓰던 조합을 가져온다 (자동 이관)", () => {
    const m = new ShortcutManager();
    const combo = m.getCombo("undo")!; // Ctrl+Z
    const result = m.assign("copy-image", combo);
    expect(result.ok).toBe(true);
    expect(result.stolenFrom).toBe("undo");
    expect(m.getCombo("undo")).toBeNull();
    expect(combosEqual(m.getCombo("copy-image"), combo)).toBe(true);
  });

  it("브라우저 예약 조합은 거부한다", () => {
    const m = new ShortcutManager();
    const result = m.assign("undo", { key: "w", ctrl: true, shift: false, alt: false, meta: false });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("녹화 모드: 다음 키 입력을 콜백으로 전달하고 액션은 실행하지 않는다", () => {
    const m = new ShortcutManager();
    const action = vi.fn();
    m.on("undo", action);
    const recorded = vi.fn();
    m.startRecording(recorded);
    expect(m.isRecording).toBe(true);
    const res = m.handleKeydown(ev("z", { ctrl: true }));
    expect(res.handled).toBe(true);
    expect(action).not.toHaveBeenCalled();
    expect(recorded).toHaveBeenCalledWith(
      expect.objectContaining({ key: "z", ctrl: true }),
    );
    expect(m.isRecording).toBe(false);
  });

  it("녹화 중 Esc 는 null 을 전달한다 (취소)", () => {
    const m = new ShortcutManager();
    const recorded = vi.fn();
    m.startRecording(recorded);
    m.handleKeydown(ev("Escape"));
    expect(recorded).toHaveBeenCalledWith(null);
  });

  it("clear / resetAll", () => {
    const m = new ShortcutManager();
    m.clear("undo");
    expect(m.getCombo("undo")).toBeNull();
    m.resetAll();
    expect(m.getCombo("undo")).not.toBeNull();
  });

  it("onChange 는 변경 시마다 호출된다", () => {
    const m = new ShortcutManager();
    const onChange = vi.fn();
    m.onChange = onChange;
    m.assign("undo", { key: "u", ctrl: true, shift: false, alt: false, meta: false });
    m.clear("undo");
    m.resetAll();
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe("직렬화", () => {
  it("serialize → parse 왕복이 보존된다", () => {
    const m = new ShortcutManager();
    m.assign("undo", { key: "u", ctrl: true, shift: false, alt: false, meta: false });
    m.clear("copy-image");
    const restored = parseShortcuts(serializeShortcuts(m.getMap()))!;
    expect(restored.undo).toEqual({ key: "u", ctrl: true, shift: false, alt: false, meta: false });
    expect(restored["copy-image"]).toBeNull();
  });

  it("모르는 액션 id 와 쓰레기 값은 걸러낸다", () => {
    const out = parseShortcutsValue({
      undo: { key: "z", ctrl: true },
      "fake-action": { key: "q" },
      "copy-image": { notKey: 1 },
    })!;
    expect(out.undo).toBeTruthy();
    expect("fake-action" in out).toBe(false);
    expect("copy-image" in out).toBe(false);
  });

  it("잘못된 JSON 은 null", () => {
    expect(parseShortcuts("{oops")).toBeNull();
    expect(parseShortcuts(null)).toBeNull();
  });

  it("복원된 커스텀 조합이 생성자에 반영된다", () => {
    const custom: KeyCombo = { key: "F2", ctrl: false, shift: false, alt: false, meta: false };
    const m = new ShortcutManager({ undo: custom });
    expect(combosEqual(m.getCombo("undo"), custom)).toBe(true);
    // 나머지는 기본값 유지
    expect(m.getCombo("export-image")).toEqual(defaultShortcuts()["export-image"]);
  });
});

describe("기본 단축키 무결성", () => {
  it("모든 액션에 대응하는 기본 항목이 있다", () => {
    const d = defaultShortcuts();
    for (const a of ACTIONS) expect(a.id in d).toBe(true);
  });

  it("기본 단축키끼리 충돌하지 않는다", () => {
    const d = defaultShortcuts();
    const seen: string[] = [];
    for (const combo of Object.values(d)) {
      if (!combo) continue;
      const key = formatCombo(combo);
      expect(seen).not.toContain(key);
      seen.push(key);
    }
  });

  it("모든 액션이 알려진 그룹에 속한다", () => {
    for (const a of ACTIONS) expect(ACTION_GROUPS).toContain(a.group);
  });

  it("빈 그룹이 없다 — 설정 목록에 모든 그룹이 나타난다", () => {
    for (const g of ACTION_GROUPS) {
      expect(ACTIONS.filter((a) => a.group === g).length).toBeGreaterThan(0);
    }
  });

  it("액션 id 가 중복되지 않는다", () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
