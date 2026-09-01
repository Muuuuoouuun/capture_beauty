import { describe, expect, it, vi } from "vitest";
import {
  adjustmentsToFilterParams,
  AiFilterError,
  AI_FILTERS,
  analyzeImage,
  parseAdjustments,
  transformViaEndpoint,
  type BetaMessageCreate,
} from "../src/ai";

const validAdjustments = {
  brightness: 10,
  contrast: 15,
  saturation: -5,
  temperature: 20,
  tint: 0,
  sharpen: 30,
  vignette: 10,
  grain: 0,
  sepia: 0,
  comment: "노출을 살짝 올리고 따뜻하게 보정했어요.",
};

describe("parseAdjustments", () => {
  it("유효한 JSON 을 파싱한다", () => {
    const out = parseAdjustments(JSON.stringify(validAdjustments));
    expect(out.brightness).toBe(10);
    expect(out.comment).toContain("보정");
  });

  it("범위를 살짝 벗어난 값은 클램프한다", () => {
    const out = parseAdjustments(
      JSON.stringify({ ...validAdjustments, brightness: 130, sharpen: -5 }),
    );
    expect(out.brightness).toBe(100);
    expect(out.sharpen).toBe(0);
  });

  it("JSON 이 아니면 AiFilterError", () => {
    expect(() => parseAdjustments("not json")).toThrow(AiFilterError);
  });

  it("필드가 빠지면 AiFilterError", () => {
    expect(() => parseAdjustments(JSON.stringify({ brightness: 1 }))).toThrow(AiFilterError);
  });
});

describe("adjustmentsToFilterParams", () => {
  it("AI 값 을 필터 파라미터로 옮기고 나머지는 깨끗한 기본값", () => {
    const p = adjustmentsToFilterParams(parseAdjustments(JSON.stringify(validAdjustments)));
    expect(p.brightness).toBe(10);
    expect(p.sharpen).toBe(30);
    expect(p.blur).toBe(0);
    expect(p.grayscale).toBe(false);
    expect(p.invert).toBe(false);
  });
});

describe("analyzeImage", () => {
  const req = {
    apiKey: "sk-test",
    imageBase64: "aGVsbG8=",
    mediaType: "image/jpeg" as const,
    instruction: "자연스럽게 보정해줘",
  };

  const messageWith = (overrides: Record<string, unknown>) =>
    ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(validAdjustments) }],
      ...overrides,
    }) as never;

  it("요청 파라미터에 모델/베타/폴백/이미지가 들어간다", async () => {
    const create = vi.fn<BetaMessageCreate>().mockResolvedValue(messageWith({}));
    await analyzeImage(req, create);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.fallbacks).toBe("default");
    expect(params.output_config).toBeTruthy();
    const messages = params.messages as {
      content: { type: string; source?: { data: string } }[];
    }[];
    expect(messages[0].content[0].type).toBe("image");
    expect(messages[0].content[0].source?.data).toBe("aGVsbG8=");
  });

  it("정상 응답에서 보정값을 반환한다", async () => {
    const create = vi.fn<BetaMessageCreate>().mockResolvedValue(messageWith({}));
    const out = await analyzeImage(req, create);
    expect(out.contrast).toBe(15);
  });

  it("thinking 블록이 섞여 있어도 text 블록을 찾는다", async () => {
    const create = vi.fn<BetaMessageCreate>().mockResolvedValue(
      messageWith({
        content: [
          { type: "thinking", thinking: "..." },
          { type: "text", text: JSON.stringify(validAdjustments) },
        ],
      }),
    );
    const out = await analyzeImage(req, create);
    expect(out.brightness).toBe(10);
  });

  it("refusal 이면 친절한 에러를 던진다", async () => {
    const create = vi.fn<BetaMessageCreate>().mockResolvedValue(
      messageWith({
        stop_reason: "refusal",
        stop_details: { type: "refusal", explanation: "정책상 처리할 수 없는 이미지" },
        content: [],
      }),
    );
    await expect(analyzeImage(req, create)).rejects.toThrow(/거절/);
  });

  it("API 예외는 AiFilterError 로 감싼다", async () => {
    const create = vi.fn<BetaMessageCreate>().mockRejectedValue(new Error("boom"));
    await expect(analyzeImage(req, create)).rejects.toThrow(AiFilterError);
  });
});

describe("AI_FILTERS", () => {
  it("id 는 고유하고 지시문이 비어있지 않다", () => {
    const ids = AI_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of AI_FILTERS) expect(f.instruction.length).toBeGreaterThan(5);
  });
});

describe("transformViaEndpoint", () => {
  const png = "data:image/png;base64,AAA";

  it("성공 시 변환된 dataURL 을 반환한다", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ image: "data:image/png;base64,BBB" }), { status: 200 }),
    );
    const out = await transformViaEndpoint("https://x.test/t", png, "배경 제거", fetchFn as typeof fetch);
    expect(out).toBe("data:image/png;base64,BBB");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://x.test/t");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      image: png,
      instruction: "배경 제거",
    });
  });

  it("HTTP 오류면 상태 코드를 포함해 던진다", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(transformViaEndpoint("https://x.test/t", png, "", fetchFn as typeof fetch))
      .rejects.toThrow(/500/);
  });

  it("image 필드가 dataURL 이 아니면 거부한다", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ image: "http://evil/img.png" }), { status: 200 }),
    );
    await expect(transformViaEndpoint("https://x.test/t", png, "", fetchFn as typeof fetch))
      .rejects.toThrow(/data URL/);
  });

  it("연결 실패는 친절한 메시지로 감싼다", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(transformViaEndpoint("https://x.test/t", png, "", fetchFn as typeof fetch))
      .rejects.toThrow(/연결하지 못했습니다/);
  });
});
