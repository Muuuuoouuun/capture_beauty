import { describe, expect, it } from "vitest";
import {
  createStamp,
  DATE_FORMATS,
  formatDateStamp,
  idealTextOn,
  STAMP_PRESETS,
  stampDisplayText,
} from "../src/stamps";

const testDate = new Date(2026, 7, 24, 14, 30, 5); // 2026-08-24 (월) 14:30:05

describe("formatDateStamp", () => {
  it("기본 토큰을 치환한다", () => {
    expect(formatDateStamp("YYYY-MM-DD", testDate)).toBe("2026-08-24");
    expect(formatDateStamp("YYYY-MM-DD HH:mm", testDate)).toBe("2026-08-24 14:30");
    expect(formatDateStamp("HH:mm:ss", testDate)).toBe("14:30:05");
  });

  it("한국어 형식과 요일을 지원한다", () => {
    expect(formatDateStamp("YYYY년 MM월 DD일", testDate)).toBe("2026년 08월 24일");
    expect(formatDateStamp("YYYY.MM.DD (ddd)", testDate)).toBe("2026.08.24 (월)");
  });

  it("두 자리 연도(YY)를 지원한다", () => {
    expect(formatDateStamp("YY/MM/DD", testDate)).toBe("26/08/24");
  });

  it("토큰이 아닌 문자는 그대로 둔다", () => {
    expect(formatDateStamp("촬영: YYYY-MM-DD", testDate)).toBe("촬영: 2026-08-24");
  });
});

describe("createStamp / stampDisplayText", () => {
  it("datetime 스탬프는 형식을 날짜로 렌더링한다", () => {
    const s = createStamp("datetime", { text: "YYYY-MM-DD" });
    expect(stampDisplayText(s, testDate)).toBe("2026-08-24");
  });

  it("텍스트 스탬프는 텍스트를 그대로 보여준다", () => {
    const s = createStamp("text", { text: "승인" });
    expect(stampDisplayText(s, testDate)).toBe("승인");
  });

  it("id 는 매번 고유하다", () => {
    const a = createStamp("text");
    const b = createStamp("text");
    expect(a.id).not.toBe(b.id);
  });

  it("좌표/크기 기본값은 유효 범위 안이다", () => {
    const s = createStamp("datetime");
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(1);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThanOrEqual(1);
    expect(s.opacity).toBeGreaterThan(0);
    expect(s.opacity).toBeLessThanOrEqual(1);
  });
});

describe("프리셋", () => {
  it("스탬프 프리셋 id 는 고유하다", () => {
    const ids = STAMP_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 프리셋은 유효한 스탬프를 만든다", () => {
    for (const p of STAMP_PRESETS) {
      const s = p.make();
      expect(s.id).toBeTruthy();
      expect(s.text.length).toBeGreaterThan(0);
    }
  });

  it("날짜 형식 프리셋은 모두 파싱 가능한 결과를 낸다", () => {
    for (const f of DATE_FORMATS) {
      const out = formatDateStamp(f.id, testDate);
      expect(out).not.toContain("YYYY");
      expect(out).not.toContain("MM");
    }
  });
});

describe("idealTextOn", () => {
  it("어두운 배경엔 흰 텍스트", () => {
    expect(idealTextOn("#0f172a")).toBe("#ffffff");
  });
  it("밝은 배경엔 검은 텍스트", () => {
    expect(idealTextOn("#f5f5f5")).toBe("#111111");
  });
  it("잘못된 색은 흰 텍스트로 폴백", () => {
    expect(idealTextOn("red")).toBe("#ffffff");
  });
});
