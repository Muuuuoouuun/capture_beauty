import type { Tool } from "@/lib/types";

export type ScoreBreakdown = {
  functionality: number;
  uiux: number;
  reliability: number;
  comfort: number;
  pricing: number;
};

export type CapabilityComparison = {
  competitor: string;
  worksBetterHere: string;
  weakerHere: string;
};

export type PatchNote = {
  date: string;
  title: string;
  change: string;
  errorRisk: string;
};

export type WorkPlaybook = {
  title: string;
  howToUse: string;
  recommendation: string;
};

export type ToolInsight = {
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  oneLine: string;
  comparisons: CapabilityComparison[];
  patchNotes: PatchNote[];
  workPlaybook: WorkPlaybook[];
};

const overrides: Record<string, Partial<ToolInsight>> = {
  "d41f50a2-3b7c-4f7e-8c73-1b8d0b0fe21a": {
    oneLine: "Great when your team needs one operating system; risky when governance is weak."
  },
  "ef6b79b4-7c1e-4df0-95f1-9011f412e1cb": {
    oneLine: "Best for fast coordination, worst for deep-focus teams without async rules."
  }
};

const clamp = (score: number) => Math.max(0, Math.min(100, score));

const deriveScoreBreakdown = (tool: Tool): ScoreBreakdown => ({
  functionality: clamp(tool.impact.executionDensity * 10 + 10),
  uiux: clamp(tool.impact.collaborationClarity * 10),
  reliability: clamp((10 - (tool.verdictBadges.lockinRisk ? 2 : 0)) * 8),
  comfort: clamp(tool.impact.thinkingDepth * 10),
  pricing: clamp(tool.verdictBadges.lockinRisk ? 55 : 72)
});

const deriveComparisons = (tool: Tool): CapabilityComparison[] => [
  {
    competitor: tool.alternatives[0] ?? "Manual workflow",
    worksBetterHere: `${tool.name} centralizes context faster for ${tool.problemContexts[0]?.toLowerCase() ?? "teams"}.`,
    weakerHere: `${tool.name} can feel heavy if your team only needs lightweight checklists.`
  },
  {
    competitor: tool.alternatives[1] ?? "Spreadsheet + docs",
    worksBetterHere: `${tool.name} improves visibility when multiple stakeholders need one source of truth.`,
    weakerHere: `${tool.name} may reduce portability compared with simpler stacks.`
  }
];

const derivePatchNotes = (tool: Tool): PatchNote[] => [
  {
    date: "2026-01-15",
    title: "Workspace navigation update",
    change: "Refined project views and saved filters for faster discovery.",
    errorRisk: "Legacy links may open outdated views until bookmarks are refreshed."
  },
  {
    date: "2025-11-02",
    title: "Permission and policy changes",
    change: "Expanded admin controls for audit and sharing boundaries.",
    errorRisk: "Misconfigured roles can temporarily block collaborators from critical pages."
  }
];

const deriveWorkPlaybook = (tool: Tool): WorkPlaybook[] => [
  {
    title: "Weekly decision review",
    howToUse: `Use ${tool.name} to capture top decisions from product, ops, and customer teams in one weekly log.`,
    recommendation: "Assign one owner to summarize decisions every Friday to prevent context fragmentation."
  },
  {
    title: "Execution planning rhythm",
    howToUse: `Create a recurring planning board that links priorities, owners, and blocked items in ${tool.name}.`,
    recommendation: "Keep the board under 15 active items; archive aggressively to preserve clarity."
  }
];

export const getToolInsight = (tool: Tool): ToolInsight => {
  const scoreBreakdown = deriveScoreBreakdown(tool);
  const totalScore = Math.round(
    (scoreBreakdown.functionality +
      scoreBreakdown.uiux +
      scoreBreakdown.reliability +
      scoreBreakdown.comfort +
      scoreBreakdown.pricing) /
      5
  );

  return {
    totalScore,
    scoreBreakdown,
    oneLine: `${tool.name} helps teams move faster, but requires clear usage rules to avoid cognitive overload.`,
    comparisons: deriveComparisons(tool),
    patchNotes: derivePatchNotes(tool),
    workPlaybook: deriveWorkPlaybook(tool),
    ...overrides[tool.id]
  };
};
