import { z } from "zod";

export const forecastSchema = z.object({
  questionId: z.string().min(1),
  probability: z.number().min(0).max(100),
  confidence: z.number().int().min(1).max(5).optional(),
  updatedFromId: z.string().optional()
});

export const questionSchema = z.object({
  title: z.string().min(10).max(220),
  category: z.string().min(2),
  openAt: z.string(),
  closeAt: z.string(),
  resolveExpectedAt: z.string(),
  resolverType: z.enum(["official_api", "official_link"]),
  resolverConfigJson: z.record(z.any()),
  status: z.enum(["OPEN", "DRAFT"]).default("OPEN")
});
