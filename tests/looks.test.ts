import { describe, expect, it } from "vitest";
import { getLook, LOOKS, pickRandomLook, RANDOM_LOOK_ID, validateLooks } from "../src/looks";

describe("LOOKS", () => {
  it("id 는 고유하다", () => {
    const ids = LOOKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("참조하는 필터/스마트 배경 프리셋이 모두 존재한다", () => {
    expect(validateLooks()).toEqual([]);
  });

  it("'없음' 과 '랜덤' 룩이 존재한다", () => {
    expect(getLook("look-none")).toBeTruthy();
    expect(getLook(RANDOM_LOOK_ID)).toBeTruthy();
  });

  it("getLook 은 없는 id 에 null", () => {
    expect(getLook("nope")).toBeNull();
  });
});

describe("pickRandomLook", () => {
  it("'없음'/'랜덤' 을 제외한 룩을 고른다", () => {
    for (let i = 0; i < 20; i++) {
      const look = pickRandomLook();
      expect(look.id).not.toBe("look-none");
      expect(look.id).not.toBe(RANDOM_LOOK_ID);
    }
  });

  it("rand 주입으로 결정적으로 동작한다", () => {
    const first = pickRandomLook(() => 0);
    const last = pickRandomLook(() => 0.999999);
    expect(first.id).toBe(LOOKS.filter((l) => l.id !== "look-none" && l.id !== RANDOM_LOOK_ID)[0].id);
    expect(first.id).not.toBe(last.id);
  });
});
