export interface GlobalShortcutsConfig {
  quick: string;
  edit: string;
}
export declare const DEFAULT_GLOBAL_SHORTCUTS: Readonly<GlobalShortcutsConfig>;
export declare function isValidAccelerator(value: unknown): boolean;
export declare function normalizeGlobalShortcuts(raw: unknown): GlobalShortcutsConfig;
