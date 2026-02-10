import { describe, expect, it } from "vitest";
import { GET as getTools } from "@/app/api/tools/route";
import { GET as getToolById } from "@/app/api/tool/[id]/route";
import { GET as searchTools } from "@/app/api/search/route";
import { POST as createTool } from "@/app/api/tool/route";

const getJson = async (response: Response) => response.json();

describe("API routes", () => {
  it("returns all tools", async () => {
    const response = await getTools();
    const data = await getJson(response);
    expect(response.status).toBe(200);
    expect(data.tools.length).toBeGreaterThanOrEqual(10);
  });

  it("returns a tool by id", async () => {
    const response = await getToolById(new Request("http://localhost/api/tool"), {
      params: { id: "d41f50a2-3b7c-4f7e-8c73-1b8d0b0fe21a" }
    });
    const data = await getJson(response);
    expect(response.status).toBe(200);
    expect(data.tool.name).toBe("Notion");
  });

  it("searches tools by problem context", async () => {
    const response = await searchTools(new Request("http://localhost/api/search?problem=communication"));
    const data = await getJson(response);
    expect(response.status).toBe(200);
    expect(data.tools.length).toBeGreaterThan(0);
  });

  it("validates tool creation", async () => {
    const response = await createTool(
      new Request("http://localhost/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );
    expect(response.status).toBe(400);
  });

  it("creates tool with valid payload", async () => {
    const response = await createTool(
      new Request("http://localhost/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "SignalFlow",
          description: "AI workflow engine for noisy signals.",
          problemContexts: ["We miss critical alerts"],
          whyExist: "Teams needed a reliable filter for operational noise.",
          impact: {
            judgmentSpeed: 6,
            thinkingDepth: 6,
            executionDensity: 7,
            collaborationClarity: 5
          },
          bestCase: "Keeps urgent signals visible without panicking teams.",
          worstCase: "Over-automates response without context.",
          verdictBadges: {
            timeSaver: true,
            thinkCarefully: true,
            lockinRisk: false
          },
          alternatives: ["Manual triage", "Custom scripts"]
        })
      })
    );
    const data = await getJson(response);
    expect(response.status).toBe(201);
    expect(data.tool.id).toBeDefined();
  });
});
