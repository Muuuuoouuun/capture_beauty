import { describe, expect, it } from "vitest";
import {
  applyFilters,
  clampFilterParams,
  defaultFilterParams,
  FILTER_PRESETS,
  isNeutral,
  presetToParams,
} from "../src/filters";
import { getPixel, solidImage } from "./helpers";

describe("defaultFilterParams", () => {
  it("기본값은 중립(변화 없음)이다", () => {
    expect(isNeutral(defaultFilterParams())).toBe(true);
  });

  it("중립 필터는 픽셀을 바꾸지 않는다", () => {
    const img = solidImage(4, 4, [120, 80, 200, 255]);
    const out = applyFilters(img, defaultFilterParams());
    expect(getPixel(out, 2, 2)).toEqual([120, 80, 200, 255]);
  });

  it("입력 이미지를 변형하지 않는다 (복사본 반환)", () => {
    const img = solidImage(4, 4, [100, 100, 100, 255]);
    applyFilters(img, { ...defaultFilterParams(), brightness: 50 });
    expect(getPixel(img, 0, 0)).toEqual([100, 100, 100, 255]);
  });
});

describe("applyFilters", () => {
  it("밝기 +는 픽셀 값을 올린다", () => {
    const img = solidImage(4, 4, [100, 100, 100, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), brightness: 50 });
    const [r] = getPixel(out, 1, 1);
    expect(r).toBe(150); // 100 * 1.5
  });

  it("밝기 -100 이면 검정이 된다", () => {
    const img = solidImage(4, 4, [200, 150, 90, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), brightness: -100 });
    expect(getPixel(out, 0, 0).slice(0, 3)).toEqual([0, 0, 0]);
  });

  it("대비 +는 128 위 값을 더 밝게, 아래 값을 더 어둡게 만든다", () => {
    const bright = solidImage(2, 2, [180, 180, 180, 255]);
    const dark = solidImage(2, 2, [70, 70, 70, 255]);
    const p = { ...defaultFilterParams(), contrast: 60 };
    expect(getPixel(applyFilters(bright, p), 0, 0)[0]).toBeGreaterThan(180);
    expect(getPixel(applyFilters(dark, p), 0, 0)[0]).toBeLessThan(70);
  });

  it("흑백은 RGB 채널을 같게 만든다", () => {
    const img = solidImage(2, 2, [200, 50, 120, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), grayscale: true });
    const [r, g, b] = getPixel(out, 0, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("반전은 255-v 이다", () => {
    const img = solidImage(2, 2, [200, 50, 0, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), invert: true });
    expect(getPixel(out, 0, 0).slice(0, 3)).toEqual([55, 205, 255]);
  });

  it("채도 -100 은 흑백과 같다", () => {
    const img = solidImage(2, 2, [220, 40, 100, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), saturation: -100 });
    const [r, g, b] = getPixel(out, 0, 0);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  });

  it("색온도 +는 R을 올리고 B를 내린다", () => {
    const img = solidImage(2, 2, [100, 100, 100, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), temperature: 50 });
    const [r, , b] = getPixel(out, 0, 0);
    expect(r).toBeGreaterThan(100);
    expect(b).toBeLessThan(100);
  });

  it("비네트는 모서리를 중심보다 어둡게 한다", () => {
    const img = solidImage(21, 21, [200, 200, 200, 255]);
    const out = applyFilters(img, { ...defaultFilterParams(), vignette: 80 });
    const center = getPixel(out, 10, 10)[0];
    const corner = getPixel(out, 0, 0)[0];
    expect(corner).toBeLessThan(center);
  });

  it("알파 채널은 유지된다", () => {
    const img = solidImage(2, 2, [10, 20, 30, 128]);
    const out = applyFilters(img, { ...defaultFilterParams(), brightness: 40, contrast: 20 });
    expect(getPixel(out, 0, 0)[3]).toBe(128);
  });
});

describe("clampFilterParams", () => {
  it("범위를 벗어난 값을 자른다", () => {
    const p = clampFilterParams({
      ...defaultFilterParams(),
      brightness: 500,
      contrast: -500,
      sharpen: -10,
      vignette: 300,
    });
    expect(p.brightness).toBe(100);
    expect(p.contrast).toBe(-100);
    expect(p.sharpen).toBe(0);
    expect(p.vignette).toBe(100);
  });
});

describe("FILTER_PRESETS", () => {
  it("모든 프리셋 id 는 고유하다", () => {
    const ids = FILTER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("presetToParams 는 기본값 위에 프리셋을 덮는다", () => {
    const vintage = FILTER_PRESETS.find((p) => p.id === "vintage")!;
    const params = presetToParams(vintage);
    expect(params.sepia).toBe(35);
    expect(params.brightness).toBe(0); // 지정 안 한 값은 기본값
  });
});
