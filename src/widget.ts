/**
 * 캡처 위젯 — Document Picture-in-Picture 로 띄우는 초소형 "카메라 리모컨".
 * 모든 앱 위에 항상 떠 있으므로(OS 최상위 창), 브라우저 탭이나 프로그램 창을
 * 띄우지 않고도 셔터를 누를 수 있다. (macOS Cmd+Shift+5 컨트롤 스트립 /
 * Snagit 캡처 위젯 포지션)
 *
 * 연속 캡처(CaptureSession)와 조합하면: 최초 1회 화면 연결 이후
 * 위젯 셔터 → 즉시 프레임 캡처 → 자동 복사/저장, 창 전환 0회.
 */

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPictureInPicture {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

import { icon } from "./icons";

export function isWidgetSupported(): boolean {
  return typeof window !== "undefined" && !!window.documentPictureInPicture;
}

export interface WidgetCallbacks {
  /** 셔터 클릭 — 반드시 위젯 창 컨텍스트의 사용자 제스처 안에서 호출됨 */
  onShutter: (widgetWindow: Window) => void;
  onToggleSession: (widgetWindow: Window) => void;
  onOpenEditor: () => void;
  onClosed: () => void;
}

export interface WidgetHandle {
  window: Window;
  setSessionActive(active: boolean): void;
  setThumbnail(dataUrl: string | null): void;
  setStatus(text: string): void;
  close(): void;
}

const WIDGET_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    background: #14141c;
    color: #e8e8ef;
    height: 100vh;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    overflow: hidden;
    user-select: none;
  }
  button {
    border: 1px solid #2e2e3c;
    background: #23232f;
    color: #e8e8ef;
    border-radius: 9px;
    cursor: pointer;
    font-size: 15px;
    padding: 0;
  }
  button:hover { background: #2c2c3b; }
  #w-shutter {
    width: 52px; height: 52px;
    border-radius: 50%;
    border: 3px solid rgba(232,232,239,0.9);
    background: transparent;
    padding: 4px;
    flex-shrink: 0;
  }
  #w-shutter span {
    display: block; width: 100%; height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, #ff5c8a, #ff7a5c);
  }
  #w-shutter:active { transform: scale(0.93); }
  .col { display: flex; flex-direction: column; gap: 6px; }
  .col button {
    width: 34px; height: 26px; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
  }
  #w-session.active { border-color: #e5484d; background: rgba(229,72,77,0.18); }
  #w-thumb-box {
    flex: 1;
    height: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    justify-content: center;
  }
  #w-thumb {
    max-width: 100%;
    max-height: calc(100% - 18px);
    border-radius: 6px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    display: none;
    cursor: pointer;
  }
  #w-status {
    font-size: 10.5px;
    color: #9a9aad;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .live-dot { color: #ff5c5c; }
`;

/** 위젯 창을 연다. 사용자 제스처(클릭) 컨텍스트에서 호출해야 한다. */
export async function openWidget(callbacks: WidgetCallbacks): Promise<WidgetHandle> {
  const api = window.documentPictureInPicture;
  if (!api) {
    throw new Error("이 브라우저는 PiP 위젯을 지원하지 않습니다. (Chrome 116+ 필요)");
  }
  const pip = await api.requestWindow({ width: 320, height: 132 });
  const doc = pip.document;
  doc.title = "Capture Beauty 위젯";

  const style = doc.createElement("style");
  style.textContent = WIDGET_CSS;
  doc.head.appendChild(style);

  const shutter = doc.createElement("button");
  shutter.id = "w-shutter";
  shutter.title = "캡처 (셔터)";
  shutter.appendChild(doc.createElement("span"));

  const col = doc.createElement("div");
  col.className = "col";
  const sessionBtn = doc.createElement("button");
  sessionBtn.id = "w-session";
  sessionBtn.title = "연속 캡처 연결/해제";
  sessionBtn.innerHTML = icon("link", 14);
  const editorBtn = doc.createElement("button");
  editorBtn.id = "w-editor";
  editorBtn.title = "편집 창 열기";
  editorBtn.innerHTML = icon("pencil", 14);
  col.append(sessionBtn, editorBtn);

  const thumbBox = doc.createElement("div");
  thumbBox.id = "w-thumb-box";
  const thumb = doc.createElement("img");
  thumb.id = "w-thumb";
  thumb.title = "클릭하면 편집 창이 열립니다";
  const status = doc.createElement("div");
  status.id = "w-status";
  status.textContent = "🔗 를 눌러 화면을 연결하세요";
  thumbBox.append(thumb, status);

  doc.body.append(shutter, col, thumbBox);

  shutter.addEventListener("click", () => callbacks.onShutter(pip));
  sessionBtn.addEventListener("click", () => callbacks.onToggleSession(pip));
  editorBtn.addEventListener("click", () => callbacks.onOpenEditor());
  thumb.addEventListener("click", () => callbacks.onOpenEditor());
  pip.addEventListener("pagehide", () => callbacks.onClosed());

  return {
    window: pip,
    setSessionActive(active: boolean) {
      sessionBtn.classList.toggle("active", active);
      sessionBtn.innerHTML = icon(active ? "x" : "link", 14);
      sessionBtn.title = active ? "연속 캡처 해제" : "연속 캡처 연결";
      status.innerHTML = active
        ? '<span class="live-dot">●</span> 연결됨 — 셔터를 누르면 즉시 캡처'
        : "🔗 를 눌러 화면을 연결하세요";
    },
    setThumbnail(dataUrl: string | null) {
      if (dataUrl) {
        thumb.src = dataUrl;
        thumb.style.display = "block";
      } else {
        thumb.style.display = "none";
      }
    },
    setStatus(text: string) {
      status.textContent = text;
    },
    close() {
      pip.close();
    },
  };
}
