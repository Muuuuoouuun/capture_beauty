import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLOBAL_SHORTCUTS,
  isValidAccelerator,
  normalizeGlobalShortcuts,
} from "../desktop/config.cjs";

describe("isValidAccelerator", () => {
  it("표준 accelerator 를 허용한다", () => {
    expect(isValidAccelerator("CommandOrControl+Shift+1")).toBe(true);
    expect(isValidAccelerator("Ctrl+Alt+S")).toBe(true);
    expect(isValidAccelerator("F9")).toBe(true);
    expect(isValidAccelerator("Alt+F1")).toBe(true);
  });

  it("잘못된 값을 거부한다", () => {
    expect(isValidAccelerator("")).toBe(false);
    expect(isValidAccelerator("   ")).toBe(false);
    expect(isValidAccelerator("Ctrl+")).toBe(false);
    expect(isValidAccelerator("+S")).toBe(false);
    expect(isValidAccelerator("Ctrl+Shift")).toBe(false); // 수식키로 끝남
    expect(isValidAccelerator("Hello+World+X")).toBe(false); // 알 수 없는 수식키
    expect(isValidAccelerator("Ctrl + S")).toBe(false); // 공백
    expect(isValidAccelerator(123)).toBe(false);
    expect(isValidAccelerator(null)).toBe(false);
  });
});

describe("normalizeGlobalShortcuts", () => {
  it("객체가 아니면 기본값", () => {
    expect(normalizeGlobalShortcuts(null)).toEqual(DEFAULT_GLOBAL_SHORTCUTS);
    expect(normalizeGlobalShortcuts("x")).toEqual(DEFAULT_GLOBAL_SHORTCUTS);
  });

  it("유효한 값은 유지, 잘못된 필드는 기본값", () => {
    const out = normalizeGlobalShortcuts({ quick: "Alt+F1", edit: "Ctrl+" });
    expect(out.quick).toBe("Alt+F1");
    expect(out.edit).toBe(DEFAULT_GLOBAL_SHORTCUTS.edit);
  });

  it("두 동작이 같은 키면 기본값으로 복구", () => {
    const out = normalizeGlobalShortcuts({ quick: "Alt+F1", edit: "Alt+F1" });
    expect(out).toEqual(DEFAULT_GLOBAL_SHORTCUTS);
  });

  it("기본값 자체가 유효하다", () => {
    expect(isValidAccelerator(DEFAULT_GLOBAL_SHORTCUTS.quick)).toBe(true);
    expect(isValidAccelerator(DEFAULT_GLOBAL_SHORTCUTS.edit)).toBe(true);
    expect(DEFAULT_GLOBAL_SHORTCUTS.quick).not.toBe(DEFAULT_GLOBAL_SHORTCUTS.edit);
  });
});
