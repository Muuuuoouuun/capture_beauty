import type { ShortcutMap } from "./shortcuts";
import { parseShortcutsValue } from "./shortcuts";
import type { QuickSettings } from "./quickcapture";
import { defaultQuickSettings, normalizeQuickSettings } from "./quickcapture";
import type { CaptureProfile } from "./profiles";
import { normalizeProfile, normalizeProfiles } from "./profiles";

const STORAGE_KEY = "capture-beauty:settings:v1";

export interface AppSettings {
  shortcuts: Partial<ShortcutMap> | null;
  apiKey: string;
  transformEndpoint: string;
  quick: QuickSettings;
  /** 홈 화면 도구 덱 펼침 여부 — 기본은 접힘(미니멀 캡처 화면) */
  deckOpen: boolean;
  /** 저장된 캡처 프로파일 (내 프리셋) */
  profiles: CaptureProfile[];
  /** 마지막으로 내보내기/복사에 쓰인 편집 상태 (자동 기억) */
  lastProfile: CaptureProfile | null;
}

export function defaultSettings(): AppSettings {
  return {
    shortcuts: null,
    apiKey: "",
    transformEndpoint: "",
    quick: defaultQuickSettings(),
    deckOpen: false,
    profiles: [],
    lastProfile: null,
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> = safeStorage()): AppSettings {
  const d = defaultSettings();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      shortcuts: parseShortcutsValue(parsed.shortcuts),
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      transformEndpoint: typeof parsed.transformEndpoint === "string" ? parsed.transformEndpoint : "",
      quick: normalizeQuickSettings(parsed.quick),
      deckOpen: typeof parsed.deckOpen === "boolean" ? parsed.deckOpen : d.deckOpen,
      profiles: normalizeProfiles(parsed.profiles),
      lastProfile: normalizeProfile(parsed.lastProfile),
    };
  } catch {
    return d;
  }
}

export function saveSettings(
  settings: AppSettings,
  storage: Pick<Storage, "setItem"> = safeStorage(),
): void {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        shortcuts: settings.shortcuts,
        apiKey: settings.apiKey,
        transformEndpoint: settings.transformEndpoint,
        quick: settings.quick,
        deckOpen: settings.deckOpen,
        profiles: settings.profiles,
        lastProfile: settings.lastProfile,
      }),
    );
  } catch {
    // 시크릿 모드 등 저장 불가 환경 — 조용히 무시
  }
}

function safeStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  }
}
