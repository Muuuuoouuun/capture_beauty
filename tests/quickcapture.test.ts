import { describe, expect, it } from "vitest";
import { defaultQuickSettings, normalizeQuickSettings } from "../src/quickcapture";
import { defaultSettings, loadSettings, saveSettings } from "../src/settings";

describe("normalizeQuickSettings", () => {
  it("객체가 아니면 기본값", () => {
    expect(normalizeQuickSettings(undefined)).toEqual(defaultQuickSettings());
    expect(normalizeQuickSettings(null)).toEqual(defaultQuickSettings());
    expect(normalizeQuickSettings("x")).toEqual(defaultQuickSettings());
  });

  it("유효한 값은 유지한다", () => {
    const q = normalizeQuickSettings({
      enabled: false,
      autoTrim: true,
      autoCopy: false,
      autoSave: true,
      thumbnailSec: 10,
    });
    expect(q).toEqual({
      enabled: false,
      autoTrim: true,
      autoCopy: false,
      autoSave: true,
      thumbnailSec: 10,
    });
  });

  it("잘못된 타입 필드는 기본값으로 채운다", () => {
    const d = defaultQuickSettings();
    const q = normalizeQuickSettings({ enabled: "yes", thumbnailSec: "3" });
    expect(q.enabled).toBe(d.enabled);
    expect(q.thumbnailSec).toBe(d.thumbnailSec);
  });

  it("썸네일 시간은 0~30 으로 클램프한다", () => {
    expect(normalizeQuickSettings({ thumbnailSec: -5 }).thumbnailSec).toBe(0);
    expect(normalizeQuickSettings({ thumbnailSec: 999 }).thumbnailSec).toBe(30);
    expect(normalizeQuickSettings({ thumbnailSec: Infinity }).thumbnailSec).toBe(
      defaultQuickSettings().thumbnailSec,
    );
  });
});

describe("설정 저장/복원 (quick 포함)", () => {
  const memStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
  };

  it("quick 설정이 라운드트립된다", () => {
    const storage = memStorage();
    const s = defaultSettings();
    s.apiKey = "sk-test";
    s.quick = { enabled: false, autoTrim: true, autoCopy: false, autoSave: true, thumbnailSec: 3 };
    saveSettings(s, storage);
    const loaded = loadSettings(storage);
    expect(loaded.quick).toEqual(s.quick);
    expect(loaded.apiKey).toBe("sk-test");
  });

  it("저장값이 없으면 기본 quick 설정", () => {
    const loaded = loadSettings(memStorage());
    expect(loaded.quick).toEqual(defaultQuickSettings());
  });

  it("깨진 quick 값은 기본값으로 복구된다", () => {
    const storage = memStorage();
    storage.setItem(
      "capture-beauty:settings:v1",
      JSON.stringify({ quick: { thumbnailSec: "bad", enabled: 1 } }),
    );
    const loaded = loadSettings(storage);
    expect(loaded.quick).toEqual(defaultQuickSettings());
  });
});
