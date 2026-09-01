/**
 * 데스크톱 래퍼(Electron) 브리지 타입.
 * desktop/preload.cjs 가 window.native 로 노출한다.
 * 브라우저에서 실행 중이면 window.native 는 undefined.
 */

export interface GlobalShortcutsConfig {
  /** 창 안 띄우고 즉시 캡처 (퀵 동작만 수행) */
  quick: string;
  /** 캡처 후 편집 창 표시 */
  edit: string;
}

export interface SetShortcutsResult {
  ok: boolean;
  failed: string[];
  applied: GlobalShortcutsConfig;
}

export interface NativeCapturePayload {
  dataUrl: string;
  openEditor: boolean;
}

export interface NativeBridge {
  isNative: true;
  platform: string;
  /** 창을 잠시 숨기고 주 화면을 즉시 캡처 → dataURL */
  captureNow(): Promise<string>;
  /** OS 클립보드에 이미지 복사 (창 포커스 불필요) */
  copyImage(dataUrl: string): Promise<void>;
  getGlobalShortcuts(): Promise<GlobalShortcutsConfig>;
  setGlobalShortcuts(config: GlobalShortcutsConfig): Promise<SetShortcutsResult>;
  hideWindow(): void;
  /** 영역 선택 오버레이 동안 창을 전체화면으로 — 스크린샷이 실제 화면과 1:1 로 겹쳐 보이게 */
  setFullScreen(flag: boolean): void;
  onCaptured(cb: (payload: NativeCapturePayload) => void): void;
}

declare global {
  interface Window {
    native?: NativeBridge;
  }
}

export function getNative(): NativeBridge | null {
  return typeof window !== "undefined" && window.native ? window.native : null;
}
