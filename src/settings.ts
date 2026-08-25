import type { ShortcutMap } from "./shortcuts";
import { parseShortcutsValue } from "./shortcuts";
import type { QuickSettings } from "./quickcapture";
import { defaultQuickSettings, normalizeQuickSettings } from "./quickcapture";

const STORAGE_KEY = "capture-beauty:settings:v1";

export interface AppSettings {
  shortcuts: Partial<ShortcutMap> | null;
  apiKey: string;
  transformEndpoint: string;
  quick: QuickSettings;
}

export function defaultSettings(): AppSettings {
  return { shortcuts: null, apiKey: "", transformEndpoint: "", quick: defaultQuickSettings() };
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
