const { contextBridge, ipcRenderer } = require("electron");

/**
 * 렌더러(웹앱)에 노출되는 네이티브 브리지.
 * 타입 정의: src/native.ts (NativeBridge)
 */
contextBridge.exposeInMainWorld("native", {
  isNative: true,
  platform: process.platform,

  /** 창을 잠시 숨기고 주 화면을 즉시 캡처 (선택창 없음) → dataURL */
  captureNow: () => ipcRenderer.invoke("native:capture-now"),

  /** OS 클립보드에 이미지 복사 (창 포커스 불필요) */
  copyImage: (dataUrl) => ipcRenderer.invoke("native:copy-image", dataUrl),

  getGlobalShortcuts: () => ipcRenderer.invoke("native:get-shortcuts"),
  setGlobalShortcuts: (shortcuts) => ipcRenderer.invoke("native:set-shortcuts", shortcuts),

  hideWindow: () => ipcRenderer.send("native:hide"),

  /** 영역 선택 중 전체화면 전환 (스크린샷을 실제 화면과 1:1 로) */
  setFullScreen: (flag) => ipcRenderer.send("native:set-fullscreen", !!flag),

  /** 전역 단축키/트레이 캡처 결과 수신 */
  onCaptured: (cb) => {
    ipcRenderer.on("native:captured", (_event, payload) => cb(payload));
  },
});
