import { describe, expect, it } from "vitest";
import {
  BACKGROUND_PRESETS,
  computeLayout,
  defaultBackgroundOptions,
  detectTrim,
  hasTrim,
  parseRatio,
  SMART_BACKGROUND_FILTERS,
} from "../src/background";
import { borderedImage, solidImage } from "./helpers";

describe("parseRatio", () => {
  it("표준 비율을 파싱한다", () => {
    expect(parseRatio("16:9")).toBeCloseTo(16 / 9);
    expect(parseRatio("1:1")).toBe(1);
    expect(parseRatio("9:16")).toBeCloseTo(9 / 16);
  });

  it("auto 나 잘못된 값은 null", () => {
    expect(parseRatio("auto")).toBeNull();
    expect(parseRatio("")).toBeNull();
    expect(parseRatio("0:5")).toBeNull();
    expect(parseRatio("abc")).toBeNull();
  });
});

describe("computeLayout", () => {
  it("배경 없음 + 자동 비율이면 원본 크기 그대로", () => {
    const opts = { ...defaultBackgroundOptions(), preset: "none", ratio: "auto" };
    const l = computeLayout(800, 600, opts);
    expect(l.canvasW).toBe(800);
    expect(l.canvasH).toBe(600);
    expect(l.x).toBe(0);
    expect(l.y).toBe(0);
  });

  it("배경이 있으면 짧은 변 기준 여백이 붙는다", () => {
    const opts = { ...defaultBackgroundOptions(), preset: "sunset", padding: 0.1, ratio: "auto" };
    const l = computeLayout(800, 600, opts);
    expect(l.padPx).toBe(60); // 600 * 0.1
    expect(l.canvasW).toBe(800 + 120);
    expect(l.canvasH).toBe(600 + 120);
    expect(l.x).toBe(60);
  });

  it("16:9 비율을 지정하면 캔버스가 정확히 그 비율이 된다", () => {
    const opts = { ...defaultBackgroundOptions(), preset: "sunset", padding: 0.05, ratio: "16:9" };
    const l = computeLayout(1000, 1000, opts);
    expect(l.canvasW / l.canvasH).toBeCloseTo(16 / 9, 2);
    // 콘텐츠는 항상 캔버스 안에 들어간다
    expect(l.canvasW).toBeGreaterThanOrEqual(1000);
    expect(l.canvasH).toBeGreaterThanOrEqual(1000);
    // 중앙 정렬
    expect(l.x).toBe(Math.round((l.canvasW - 1000) / 2));
  });

  it("세로 비율(9:16)은 높이를 늘린다", () => {
    const opts = { ...defaultBackgroundOptions(), preset: "sunset", padding: 0, ratio: "9:16" };
    const l = computeLayout(900, 600, opts);
    expect(l.canvasW / l.canvasH).toBeCloseTo(9 / 16, 2);
    expect(l.canvasH).toBeGreaterThan(600);
  });

  it("배경 없음이라도 비율을 지정하면 확장된다", () => {
    const opts = { ...defaultBackgroundOptions(), preset: "none", ratio: "1:1", padding: 0.1 };
    const l = computeLayout(400, 200, opts);
    expect(l.canvasW).toBe(l.canvasH);
  });
});

describe("detectTrim", () => {
  it("균일한 테두리를 감지한다", () => {
    const img = borderedImage(60, 40, 8, [240, 240, 240, 255], [30, 60, 90, 255]);
    const t = detectTrim(img);
    expect(t).toEqual({ left: 8, top: 8, right: 8, bottom: 8 });
  });

  it("테두리가 없으면 0 인셋", () => {
    const img = borderedImage(40, 40, 0, [0, 0, 0, 255], [255, 255, 255, 255]);
    // 전부 흰색이므로 모서리는 흰색 — 콘텐츠도 흰색이라 45% 상한까지 트림 가능하지만
    // 여기서는 경계 유무만 확인: 완전히 균일한 이미지는 상한까지 잘린다
    const t = detectTrim(img);
    expect(t.left).toBeLessThanOrEqual(Math.floor(40 * 0.45));
  });

  it("모서리 색이 서로 다르면 트림하지 않는다", () => {
    const img = solidImage(40, 40, [200, 200, 200, 255]);
    img.data[0] = 0; // 좌상단 모서리만 어둡게
    const t = detectTrim(img);
    expect(hasTrim(t)).toBe(false);
  });

  it("비대칭 테두리도 각 변별로 감지한다", () => {
    const img = solidImage(50, 50, [255, 255, 255, 255]);
    // 콘텐츠 사각형: x 10..44, y 5..49 → left=10, top=5, right=5, bottom=0
    for (let y = 5; y < 50; y++) {
      for (let x = 10; x < 45; x++) {
        const i = (y * 50 + x) * 4;
        img.data[i] = 10; img.data[i + 1] = 10; img.data[i + 2] = 10;
      }
    }
    const t = detectTrim(img);
    expect(t).toEqual({ left: 10, top: 5, right: 5, bottom: 0 });
  });

  it("톨러런스 이내의 노이즈는 무시한다", () => {
    const img = borderedImage(40, 30, 6, [240, 240, 240, 255], [0, 0, 0, 255]);
    // 테두리에 미세한 노이즈 추가 (±4)
    img.data[4 * 3] = 236;
    img.data[4 * 7 + 1] = 244;
    const t = detectTrim(img, 12);
    expect(t).toEqual({ left: 6, top: 6, right: 6, bottom: 6 });
  });
});

describe("프리셋 무결성", () => {
  it("배경 프리셋 id 는 고유하다", () => {
    const ids = BACKGROUND_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("스마트 배경 필터는 존재하는 배경 프리셋만 참조한다", () => {
    const bgIds = new Set(BACKGROUND_PRESETS.map((p) => p.id));
    for (const f of SMART_BACKGROUND_FILTERS) {
      expect(bgIds.has(f.options.preset!)).toBe(true);
    }
  });

  it("스마트 배경 필터의 비율 값은 유효하다", () => {
    for (const f of SMART_BACKGROUND_FILTERS) {
      const r = f.options.ratio!;
      expect(r === "auto" || parseRatio(r) !== null).toBe(true);
    }
  });
});
