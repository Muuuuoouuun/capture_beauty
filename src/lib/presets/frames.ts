import type { FramePreset } from "@/types";

export const FRAME_PRESETS: FramePreset[] = [
  {
    id: "none",
    label: "없음",
    description: "프레임 없이 원본 그대로",
  },
  {
    id: "polaroid",
    label: "폴라로이드",
    description: "하단이 넓은 흰색 즉석사진 프레임",
  },
  {
    id: "film-strip",
    label: "필름 보더",
    description: "스프로킷 홀이 있는 검정 필름 테두리",
  },
];
