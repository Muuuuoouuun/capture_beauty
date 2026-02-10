import { z } from "zod";

export const toolSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  problemContexts: z.array(z.string().min(3)).min(1),
  whyExist: z.string().min(10),
  impact: z.object({
    judgmentSpeed: z.number().min(0).max(10),
    thinkingDepth: z.number().min(0).max(10),
    executionDensity: z.number().min(0).max(10),
    collaborationClarity: z.number().min(0).max(10)
  }),
  bestCase: z.string().min(10),
  worstCase: z.string().min(10),
  verdictBadges: z.object({
    timeSaver: z.boolean(),
    thinkCarefully: z.boolean(),
    lockinRisk: z.boolean()
  }),
  alternatives: z.array(z.string().min(2)).min(1)
});
