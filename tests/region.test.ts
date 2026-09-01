import { describe, expect, it } from "vitest";
import { displayToImageRect, fitContain, normRect } from "../src/region";

describe("fitContain", () => {
  it("가로가 넓은 이미지는 가로에 맞춘다", () => {
    const f = fitContain(1600, 900, 800, 800);
    expect(f.scale).toBeCloseTo(0.5);
    expect(f.dispW).toBeCloseTo(800);
    expect(f.dispH).toBeCloseTo(450);
    expect(f.offsetX).toBeCloseTo(0);
    expect(f.offsetY).toBeCloseTo(175);
  });

  it("정확히 맞으면 오프셋 0", () => {
    const f = fitContain(320, 200, 1440, 900);
    expect(f.scale).toBeCloseTo(4.5);
    expect(f.offsetX).toBeCloseTo(0);
    expect(f.offsetY).toBeCloseTo(0);
  });

  it("이미지가 뷰포트보다 작아도 확대해 채운다", () => {
    const f = fitContain(100, 100, 500, 400);
    expect(f.scale).toBeCloseTo(4);
    expect(f.offsetX).toBeCloseTo(50);
  });
});

describe("normRect", () => {
  it("어느 방향으로 드래그해도 좌상단 기준 사각형", () => {
    expect(normRect(10, 10, 50, 40)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
    expect(normRect(50, 40, 10, 10)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
    expect(normRect(50, 10, 10, 40)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
  });
});

describe("displayToImageRect", () => {
  const fit = fitContain(320, 200, 1440, 900); // scale 4.5, offset 0,0

  it("화면 좌표를 이미지 픽셀로 변환한다", () => {
    const r = displayToImageRect({ x: 450, y: 225, w: 450, h: 225 }, fit, 320, 200);
    expect(r).toEqual({ x: 100, y: 50, w: 100, h: 50 });
  });

  it("이미지 밖 선택은 경계로 클램프한다", () => {
    const r = displayToImageRect({ x: -100, y: -100, w: 5000, h: 5000 }, fit, 320, 200);
    expect(r).toEqual({ x: 0, y: 0, w: 320, h: 200 });
  });

  it("오프셋(레터박스)을 반영한다", () => {
    const f = fitContain(1600, 900, 800, 800); // dispH 450, offsetY 175
    const r = displayToImageRect({ x: 0, y: 175, w: 800, h: 450 }, f, 1600, 900);
    expect(r).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
  });
});
