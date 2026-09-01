/**
 * AI 필터 목록 — SDK 를 끌어오지 않는 순수 메타데이터.
 * 무거운 Anthropic SDK 는 실제로 AI 를 쓸 때만 지연 로드하므로(ai.ts),
 * 목록 렌더링에 필요한 이 파일만 초기 번들에 들어간다.
 */

export interface AiFilterDef {
  id: string;
  name: string;
  description: string;
  /** Claude 에게 보낼 보정 지시 */
  instruction: string;
}

export const AI_FILTERS: AiFilterDef[] = [
  {
    id: "ai-auto",
    name: "✨ AI 자동 보정",
    description: "이미지를 분석해 최적 보정값을 자동 적용",
    instruction:
      "이 이미지의 노출, 색감, 선명도를 진단하고 가장 자연스럽고 보기 좋게 만드는 보정값을 정해줘. 과보정은 피하고 원본의 느낌을 살려줘.",
  },
  {
    id: "ai-vivid",
    name: "🌈 생생하게",
    description: "색감을 살리고 또렷하게",
    instruction: "이 이미지에 맞춰 색이 생생하고 또렷해 보이도록 보정값을 정해줘. 인쇄물처럼 탁하지 않게.",
  },
  {
    id: "ai-cinematic",
    name: "🎬 시네마틱",
    description: "영화 같은 톤과 분위기",
    instruction:
      "이 이미지에 어울리는 영화적인 색보정(시네마틱 그레이딩)을 해줘. 이미지의 내용과 분위기에 맞는 톤을 골라줘.",
  },
  {
    id: "ai-mood",
    name: "🌅 감성 무드",
    description: "따뜻하고 감성적인 무드",
    instruction: "이 이미지를 따뜻하고 감성적인 무드로 보정해줘. 소프트한 필름 느낌도 어울리면 살짝 더해줘.",
  },
  {
    id: "ai-document",
    name: "📄 문서 최적화",
    description: "스크린샷·문서 가독성 최대화",
    instruction:
      "이 이미지는 화면 캡처/문서야. 글자가 또렷하게 읽히도록 대비와 선명도를 조정하고 색 왜곡을 제거해줘. 예술적 효과는 넣지 마.",
  },
];
