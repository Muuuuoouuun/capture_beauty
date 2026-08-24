import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { FilterParams } from "./types";
import { defaultFilterParams } from "./filters";

export const AI_MODEL = "claude-opus-5";

/** Claude 가 반환하는 보정 파라미터 (구조화 출력으로 강제) */
export const AiAdjustmentsSchema = z.object({
  brightness: z.number().min(-100).max(100),
  contrast: z.number().min(-100).max(100),
  saturation: z.number().min(-100).max(100),
  temperature: z.number().min(-100).max(100),
  tint: z.number().min(-100).max(100),
  sharpen: z.number().min(0).max(100),
  vignette: z.number().min(0).max(100),
  grain: z.number().min(0).max(100),
  sepia: z.number().min(0).max(100),
  comment: z.string().describe("무엇을 왜 보정했는지 한국어 한두 문장"),
});

export type AiAdjustments = z.infer<typeof AiAdjustmentsSchema>;

export interface AiFilterDef {
  id: string;
  name: string;
  description: string;
  instruction: string;
}

/** "특정 필터를 먹이면" AI API 가 호출되는 필터 목록 */
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

const SYSTEM_PROMPT =
  "너는 사진 보정 엔진이다. 입력 이미지를 보고 요청된 방향에 맞는 보정 파라미터를 결정한다. " +
  "파라미터 의미: brightness/contrast/saturation/temperature(+따뜻,-차가움)/tint(+마젠타,-녹색)는 -100..100, " +
  "sharpen/vignette/grain/sepia는 0..100이며 모두 0이 '변화 없음'이다. " +
  "값은 실제로 그 이미지에 필요한 만큼만 사용한다.";

export interface AnalyzeRequest {
  apiKey: string;
  /** base64 (data: 접두어 제외) */
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  instruction: string;
}

/** 테스트에서 주입 가능하도록 클라이언트 생성을 분리 */
export type BetaMessageCreate = (params: Record<string, unknown>) => Promise<Anthropic.Beta.Messages.BetaMessage>;

export function makeClientCreate(apiKey: string): BetaMessageCreate {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return (params) =>
    client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
}

export class AiFilterError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AiFilterError";
  }
}

/**
 * 이미지를 Claude 에 보내 보정 파라미터를 받는다.
 * - 구조화 출력(zod)으로 응답 형식을 강제
 * - 서버측 refusal fallback("default") 활성화 — 정책상 거절되면 대체 모델이 같은 요청을 이어받음
 */
export async function analyzeImage(
  req: AnalyzeRequest,
  create: BetaMessageCreate = makeClientCreate(req.apiKey),
): Promise<AiAdjustments> {
  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    response = await create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      // SDK 타입에 아직 없는 파라미터 — 요청 본문으로 그대로 전달된다
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { format: betaZodOutputFormat(AiAdjustmentsSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: req.mediaType, data: req.imageBase64 },
            },
            { type: "text", text: req.instruction },
          ],
        },
      ],
    });
  } catch (err) {
    throw new AiFilterError(friendlyApiError(err), err);
  }

  if (response.stop_reason === "refusal") {
    const detail =
      (response as { stop_details?: { explanation?: string } }).stop_details?.explanation ?? "";
    throw new AiFilterError(`이 이미지는 AI 보정이 거절되었습니다. ${detail}`.trim());
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.Beta.BetaTextBlock => b.type === "text",
  );
  if (!textBlock) throw new AiFilterError("AI 응답에서 보정값을 찾지 못했습니다.");
  return parseAdjustments(textBlock.text);
}

/** 모델 응답 텍스트(JSON) → 검증/클램프된 보정값 */
export function parseAdjustments(text: string): AiAdjustments {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiFilterError("AI 응답이 올바른 JSON 형식이 아닙니다.");
  }
  // 범위를 살짝 벗어난 숫자는 자르고 다시 검증
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    for (const k of ["brightness", "contrast", "saturation", "temperature", "tint"]) {
      if (typeof o[k] === "number") o[k] = Math.max(-100, Math.min(100, o[k] as number));
    }
    for (const k of ["sharpen", "vignette", "grain", "sepia"]) {
      if (typeof o[k] === "number") o[k] = Math.max(0, Math.min(100, o[k] as number));
    }
  }
  const parsed = AiAdjustmentsSchema.safeParse(raw);
  if (!parsed.success) throw new AiFilterError("AI 응답 형식이 예상과 다릅니다.");
  return parsed.data;
}

/** AI 보정값을 필터 파라미터로 변환 (깨끗한 기본값 위에 적용) */
export function adjustmentsToFilterParams(adj: AiAdjustments): FilterParams {
  return {
    ...defaultFilterParams(),
    brightness: adj.brightness,
    contrast: adj.contrast,
    saturation: adj.saturation,
    temperature: adj.temperature,
    tint: adj.tint,
    sharpen: adj.sharpen,
    vignette: adj.vignette,
    grain: adj.grain,
    sepia: adj.sepia,
  };
}

function friendlyApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "API 키가 올바르지 않습니다. 설정 탭에서 키를 확인해주세요.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "API 서버에 연결하지 못했습니다. 네트워크를 확인해주세요.";
  }
  if (err instanceof Anthropic.APIError) {
    return `API 오류 (${err.status ?? "?"}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
}

/* ---------- 외부 이미지 변환 API (선택) ---------- */

/**
 * 사용자가 지정한 외부 변환 API 로 이미지를 보내 변환된 이미지를 받는다.
 * 계약: POST JSON {image: dataURL, instruction?: string} → {image: dataURL}
 * (배경 제거, 스타일 변환 등 픽셀을 직접 바꾸는 자체 서버/서비스 연동용)
 */
export async function transformViaEndpoint(
  endpointUrl: string,
  imageDataUrl: string,
  instruction = "",
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchFn(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl, instruction }),
    });
  } catch (err) {
    throw new AiFilterError("변환 API 에 연결하지 못했습니다. URL 을 확인해주세요.", err);
  }
  if (!res.ok) {
    throw new AiFilterError(`변환 API 오류 (HTTP ${res.status})`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new AiFilterError("변환 API 응답이 JSON 형식이 아닙니다.");
  }
  const image = (body as { image?: unknown })?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new AiFilterError("변환 API 응답에 data URL 형식의 image 필드가 필요합니다.");
  }
  return image;
}
