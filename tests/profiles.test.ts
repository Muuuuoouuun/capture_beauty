import { describe, expect, it } from "vitest";
import {
  buildProfile,
  clampOutputWidth,
  cloneProfileStamps,
  MAX_PROFILES,
  normalizeProfile,
  normalizeProfiles,
} from "../src/profiles";
import { defaultFilterParams } from "../src/filters";
import { defaultBackgroundOptions } from "../src/background";
import { createStamp } from "../src/stamps";

const source = () => ({
  filters: { ...defaultFilterParams(), contrast: 18, sepia: 20 },
  bg: { ...defaultBackgroundOptions(), preset: "midnight", ratio: "16:9" },
  stamps: [createStamp("text", { text: "승인", style: "seal" as const })],
  outputWidth: 1280,
});

describe("buildProfile", () => {
  it("현재 상태를 깊은 복사로 스냅샷한다", () => {
    const src = source();
    const p = buildProfile("발표용", src, { now: 1000 });
    src.filters.contrast = 0;
    src.bg.ratio = "auto";
    src.stamps[0].text = "변경";
    expect(p.filters.contrast).toBe(18);
    expect(p.bg.ratio).toBe("16:9");
    expect(p.stamps[0].text).toBe("승인");
    expect(p.outputWidth).toBe(1280);
    expect(p.name).toBe("발표용");
  });

  it("빈 이름은 기본 이름", () => {
    expect(buildProfile("   ", source()).name).toBe("내 프리셋");
  });
});

describe("cloneProfileStamps", () => {
  it("새 id 로 복제한다 (참조/충돌 방지)", () => {
    const p = buildProfile("x", source());
    const a = cloneProfileStamps(p);
    const b = cloneProfileStamps(p);
    expect(a[0].text).toBe("승인");
    expect(a[0].id).not.toBe(p.stamps[0].id);
    expect(a[0].id).not.toBe(b[0].id);
    a[0].x = 0.001;
    expect(p.stamps[0].x).not.toBe(0.001);
  });
});

describe("clampOutputWidth", () => {
  it("0/음수/비숫자는 0(원본)", () => {
    expect(clampOutputWidth(0)).toBe(0);
    expect(clampOutputWidth(-5)).toBe(0);
    expect(clampOutputWidth("800")).toBe(0);
    expect(clampOutputWidth(NaN)).toBe(0);
  });
  it("범위를 클램프한다", () => {
    expect(clampOutputWidth(800)).toBe(800);
    expect(clampOutputWidth(50)).toBe(160);
    expect(clampOutputWidth(99999)).toBe(8000);
  });
});

describe("normalizeProfile(s)", () => {
  it("저장 → 복원 라운드트립", () => {
    const p = buildProfile("문서용", source());
    const restored = normalizeProfile(JSON.parse(JSON.stringify(p)))!;
    expect(restored).toEqual(p);
  });

  it("깨진 필드는 안전값으로 복구한다", () => {
    const p = normalizeProfile({
      id: "profile:x",
      name: "복구",
      filters: { contrast: 999, brightness: "bad" },
      bg: { ratio: "16:9", padding: 99 },
      stamps: [{ kind: "text", text: "ok", opacity: 5 }, { kind: "nope" }, "junk"],
      outputWidth: -1,
    })!;
    expect(p.filters.contrast).toBe(100);
    expect(p.filters.brightness).toBe(0);
    expect(p.bg.padding).toBe(0.5);
    expect(p.stamps).toHaveLength(1);
    expect(p.stamps[0].opacity).toBe(1);
    expect(p.outputWidth).toBe(0);
  });

  it("id/name 없으면 null", () => {
    expect(normalizeProfile({ name: "x" })).toBeNull();
    expect(normalizeProfile(null)).toBeNull();
  });

  it("목록: 중복 id 제거 + 최대 개수 제한", () => {
    const p = JSON.parse(JSON.stringify(buildProfile("a", source())));
    const many = Array.from({ length: 30 }, (_, i) => ({ ...p, id: `profile:${i % 20}` }));
    const out = normalizeProfiles(many);
    expect(out.length).toBeLessThanOrEqual(MAX_PROFILES);
    expect(new Set(out.map((x) => x.id)).size).toBe(out.length);
  });
});
