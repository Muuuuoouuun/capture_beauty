/** 픽셀 버퍼만 다루는 순수 이미지 표현 — DOM 없이 테스트 가능 */
export interface RawImage {
  width: number;
  height: number;
  /** RGBA, length = width * height * 4 */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** 색/톤 보정 파라미터. 범위는 각 필드 주석 참고 */
export interface FilterParams {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  temperature: number; // -100(차갑게)..100(따뜻하게)
  tint: number; // -100(녹색)..100(마젠타)
  sharpen: number; // 0..100
  blur: number; // 0..100
  vignette: number; // 0..100
  grain: number; // 0..100
  sepia: number; // 0..100
  grayscale: boolean;
  invert: boolean;
}

export interface TrimInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type StampKind = "datetime" | "text" | "emoji";
export type StampStyle = "plain" | "badge" | "seal" | "outline" | "ribbon";

export interface Stamp {
  id: string;
  kind: StampKind;
  /** kind === 'datetime' 이면 날짜 형식 문자열, 그 외에는 표시 텍스트 */
  text: string;
  style: StampStyle;
  color: string;
  /** 이미지 기준 상대 좌표(0..1), 스탬프 중심점 */
  x: number;
  y: number;
  /** 이미지 짧은 변 대비 글자 높이 비율 (0.01..0.5) */
  size: number;
  rotation: number; // deg
  opacity: number; // 0..1
}

export interface BackgroundOptions {
  /** 배경 프리셋 id — background.ts 의 BACKGROUND_PRESETS 참고 */
  preset: string;
  solidColor: string;
  /** 콘텐츠 짧은 변 대비 여백 비율 (0..0.5) */
  padding: number;
  /** 콘텐츠 짧은 변 대비 모서리 반경 비율 (0..0.2) */
  radius: number;
  shadow: number; // 0..100
  /** 'auto' | '16:9' | '4:3' | '3:2' | '1:1' | '9:16' */
  ratio: string;
}

export interface KeyCombo {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}
