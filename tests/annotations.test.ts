import { describe, expect, it } from "vitest";
import {
  ANNOTATION_TOOLS,
  DEFAULT_ANNOTATION_SIZE,
  annotationBox,
  arrowGeometry,
  createAnnotation,
  distanceToSegment,
  hitTestAnnotation,
  isDegenerate,
  mosaicBlockPx,
  strokeWidthPx,
} from "../src/annotations";

const RECT = { x: 100, y: 50, w: 400, h: 200 };

describe("createAnnotation", () => {
  it("좌표와 크기를 범위 안으로 자른다", () => {
    const a = createAnnotation("box", -0.5, 1.7, 0.4, 0.6, { size: 500 });
    expect(a.x1).toBe(0);
    expect(a.y1).toBe(1);
    expect(a.x2).toBeCloseTo(0.4);
    expect(a.size).toBe(100);
  });

  it("id 가 겹치지 않는다 (같은 밀리초 연속 생성)", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => createAnnotation("arrow", 0, 0, 1, 1).id),
    );
    expect(ids.size).toBe(50);
  });

  it("기본 색/크기가 적용된다", () => {
    const a = createAnnotation("mosaic", 0, 0, 0.5, 0.5);
    expect(a.size).toBe(DEFAULT_ANNOTATION_SIZE);
    expect(a.color).toMatch(/^#/);
  });

  it("도구 목록에 화살표와 모자이크가 있다", () => {
    const ids = ANNOTATION_TOOLS.map((t) => t.id);
    expect(ids).toContain("arrow");
    expect(ids).toContain("mosaic");
  });
});

describe("annotationBox", () => {
  it("정규화 좌표를 이미지 영역 픽셀로 옮긴다", () => {
    const a = createAnnotation("box", 0.25, 0.5, 0.75, 1);
    expect(annotationBox(a, RECT)).toEqual({ x: 200, y: 150, w: 200, h: 100 });
  });

  it("역방향 드래그도 좌상단 기준으로 정렬된다", () => {
    const fwd = annotationBox(createAnnotation("box", 0.25, 0.5, 0.75, 1), RECT);
    const rev = annotationBox(createAnnotation("box", 0.75, 1, 0.25, 0.5), RECT);
    expect(rev).toEqual(fwd);
  });
});

describe("크기 스케일", () => {
  it("선 두께는 짧은 변에 비례한다", () => {
    expect(strokeWidthPx(50, 1000)).toBeCloseTo(strokeWidthPx(50, 500) * 2, 5);
  });

  it("아주 작은 이미지에서도 최소 두께를 보장한다", () => {
    expect(strokeWidthPx(1, 20)).toBeGreaterThanOrEqual(1.5);
  });

  it("모자이크 블록은 3px 이상 160px 이하", () => {
    expect(mosaicBlockPx(1, 10)).toBeGreaterThanOrEqual(3);
    expect(mosaicBlockPx(100, 100000)).toBeLessThanOrEqual(160);
  });

  it("모자이크 블록은 크기 값에 따라 커진다", () => {
    expect(mosaicBlockPx(80, 1000)).toBeGreaterThan(mosaicBlockPx(20, 1000));
  });
});

describe("arrowGeometry", () => {
  it("촉 날개 두 점이 촉을 기준으로 대칭이다", () => {
    const g = arrowGeometry(0, 0, 100, 0, 20);
    expect(g.tipX).toBe(100);
    expect(g.leftY).toBeCloseTo(-g.rightY, 6);
    expect(g.leftX).toBeCloseTo(g.rightX, 6);
    // 날개는 촉보다 뒤(작은 x)에 있다
    expect(g.leftX).toBeLessThan(g.tipX);
  });

  it("선의 끝은 촉 안쪽에서 멈춘다", () => {
    const g = arrowGeometry(0, 0, 100, 0, 20);
    expect(g.shaftX).toBeLessThan(g.tipX);
    expect(g.shaftX).toBeGreaterThan(g.leftX);
  });

  it("짧은 화살표는 촉이 선보다 길어지지 않는다", () => {
    const g = arrowGeometry(0, 0, 10, 0, 60);
    expect(g.length).toBe(10);
    expect(g.tipX - g.leftX).toBeLessThanOrEqual(10);
  });
});

describe("hitTest", () => {
  it("선분까지의 거리 계산", () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    // 선분 밖은 끝점까지의 거리
    expect(distanceToSegment(-4, 0, 0, 0, 10, 0)).toBeCloseTo(4);
    expect(distanceToSegment(1, 1, 5, 5, 5, 5)).toBeCloseTo(Math.hypot(4, 4));
  });

  it("화살표는 선 근처에서만 잡힌다", () => {
    const a = createAnnotation("arrow", 0, 0.5, 1, 0.5, { size: 10 });
    expect(hitTestAnnotation(a, 300, 150, RECT)).toBe(true);
    expect(hitTestAnnotation(a, 300, 40, RECT)).toBe(false);
  });

  it("박스는 영역 안에서 잡힌다", () => {
    const a = createAnnotation("box", 0.25, 0.5, 0.75, 1);
    expect(hitTestAnnotation(a, 300, 200, RECT)).toBe(true);
    expect(hitTestAnnotation(a, 120, 60, RECT)).toBe(false);
  });
});

describe("isDegenerate", () => {
  it("점 찍듯 짧은 드래그는 버린다", () => {
    expect(isDegenerate(createAnnotation("box", 0.5, 0.5, 0.502, 0.5))).toBe(true);
  });

  it("의미 있는 길이는 남긴다", () => {
    expect(isDegenerate(createAnnotation("arrow", 0.2, 0.2, 0.6, 0.7))).toBe(false);
  });
});
