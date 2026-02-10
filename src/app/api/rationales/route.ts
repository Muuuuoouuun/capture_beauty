import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  questionId: z.string(),
  text: z.string().min(5).max(5000),
  evidenceLinks: z.array(z.string().url()).default([]),
  assumptions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

export async function POST(req: Request) {
  const body = await req.json();
  const payload = schema.parse(body);
  const userId = req.headers.get("x-user-id") ?? "seed-observer";

  const rationale = await prisma.rationale.create({
    data: {
      questionId: payload.questionId,
      userId,
      text: payload.text,
      evidenceLinksJson: payload.evidenceLinks,
      assumptionsJson: payload.assumptions,
      tagsJson: payload.tags
    }
  });

  return NextResponse.json({ rationale });
}
