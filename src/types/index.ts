export type FrameStyle = "none" | "polaroid" | "film-strip";

export type StampStyle = "classic-led" | "minimal-white" | "location-date";

export type StampPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export interface ComposeOptions {
  image: HTMLImageElement;
  frame: FrameStyle;
  stamp: StampStyle;
  stampPosition: StampPosition;
  date: Date;
  locationText: string;
  showStamp: boolean;
}

export interface FrameLayout {
  /** total output canvas size */
  width: number;
  height: number;
  /** offset where the photo itself is drawn inside the canvas */
  photoX: number;
  photoY: number;
  photoWidth: number;
  photoHeight: number;
}

export interface FramePreset {
  id: FrameStyle;
  label: string;
  description: string;
}

export interface StampPreset {
  id: StampStyle;
  label: string;
  description: string;
}
