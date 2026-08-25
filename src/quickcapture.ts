/**
 * 퀵 캡처 — "창 안 띄우고 바로" 를 위한 두 축:
 *
 * 1) CaptureSession (연속 캡처): getDisplayMedia 스트림을 한 번 허용받아 유지.
 *    이후 셔터는 브라우저 선택창 없이 현재 프레임을 즉시 뜬다.
 *    (웹에서는 전역 단축키가 불가능하므로, "매번 뜨는 선택창 제거"가
 *     Win+Shift+S / Cmd+Shift+4 같은 즉시성을 얻는 핵심이다)
 *
 * 2) QuickSettings (퀵 동작): ShareX 스타일 캡처 후 자동 파이프라인 —
 *    자동 여백 제거 → 자동 복사/저장 → macOS 스타일 플로팅 썸네일.
 */

export interface QuickSettings {
  /** 켜면 캡처 직후 아래 자동 동작이 실행된다 */
  enabled: boolean;
  autoTrim: boolean;
  autoCopy: boolean;
  autoSave: boolean;
  /** 플로팅 썸네일 표시 시간 (초). 0 이면 썸네일 끔 */
  thumbnailSec: number;
}

export function defaultQuickSettings(): QuickSettings {
  return { enabled: true, autoTrim: false, autoCopy: true, autoSave: false, thumbnailSec: 6 };
}

/** 저장된 값(unknown) → 안전한 QuickSettings */
export function normalizeQuickSettings(raw: unknown): QuickSettings {
  const d = defaultQuickSettings();
  if (typeof raw !== "object" || raw === null) return d;
  const o = raw as Record<string, unknown>;
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  const sec =
    typeof o.thumbnailSec === "number" && Number.isFinite(o.thumbnailSec)
      ? Math.max(0, Math.min(30, Math.round(o.thumbnailSec)))
      : d.thumbnailSec;
  return {
    enabled: bool(o.enabled, d.enabled),
    autoTrim: bool(o.autoTrim, d.autoTrim),
    autoCopy: bool(o.autoCopy, d.autoCopy),
    autoSave: bool(o.autoSave, d.autoSave),
    thumbnailSec: sec,
  };
}

/* =========================================================
 * 연속 캡처 세션
 * ========================================================= */

export type GetStream = () => Promise<MediaStream>;

export class CaptureSession {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  /** 연결 상태 변경 알림 (사용자가 브라우저의 '공유 중지'를 눌러도 호출됨) */
  onStateChange: ((active: boolean) => void) | null = null;

  get active(): boolean {
    return this.stream !== null;
  }

  /**
   * 화면 공유를 요청하고 스트림을 유지한다.
   * getStream 을 주면 그 컨텍스트(예: PiP 위젯 창)의 mediaDevices 로 요청한다.
   */
  async connect(getStream?: GetStream): Promise<void> {
    if (this.active) return;
    const request: GetStream =
      getStream ??
      (() => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error("이 브라우저는 화면 캡처를 지원하지 않습니다.");
        }
        return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      });

    let stream: MediaStream;
    try {
      stream = await request();
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") throw new Error("화면 연결이 취소되었습니다.");
        if (err.name === "NotReadableError") {
          throw new Error("화면 소스를 열지 못했습니다. 다른 화면이나 창을 선택해보세요.");
        }
      }
      throw err instanceof Error ? err : new Error("화면 연결에 실패했습니다.");
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await new Promise<void>((resolve) => {
      if ("requestVideoFrameCallback" in video) {
        (video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => void;
        }).requestVideoFrameCallback(() => resolve());
      } else {
        setTimeout(resolve, 300);
      }
    });

    this.stream = stream;
    this.video = video;

    // 사용자가 브라우저 UI 로 공유를 중단한 경우
    for (const track of stream.getVideoTracks()) {
      track.addEventListener("ended", () => this.stop());
    }
    this.onStateChange?.(true);
  }

  /** 현재 프레임을 즉시 캔버스로 뜬다 (선택창 없음) */
  grab(): HTMLCanvasElement {
    if (!this.stream || !this.video) {
      throw new Error("연속 캡처가 연결되어 있지 않습니다.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("캡처 프레임을 읽지 못했습니다. 다시 시도해주세요.");
    }
    canvas.getContext("2d")!.drawImage(this.video, 0, 0);
    return canvas;
  }

  stop(): void {
    if (!this.stream) return;
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.onStateChange?.(false);
  }
}
