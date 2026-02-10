import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { questionSchema } from "@/lib/validation";
import { getActingUser } from "@/lib/auth";

const CREATE_THRESHOLD_BY_TIER: Record<string, number> = {
  OBSERVER: 99999,
  SIGN_READER: 0,
  MINDSEER: 0,
  PROPHET: 0,
  ORACLE: 0,
  ADMIN: 0
};

export async function POST(req: Request) {
  const body = await req.json();
  const payload = questionSchema.parse(body);

  const user = await getActingUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requiresDraft = user.reputationPoints < CREATE_THRESHOLD_BY_TIER[user.tier];

  const question = await prisma.question.create({
    data: {
      title: payload.title,
      category: payload.category,
      type: "binary",
      outcomesJson: ["YES", "NO"],
      openAt: new Date(payload.openAt),
      closeAt: new Date(payload.closeAt),
      resolveExpectedAt: new Date(payload.resolveExpectedAt),
      status: requiresDraft ? "CLOSED" : "OPEN",
      createdBy: user.id,
      resolverType: payload.resolverType,
      resolverConfigJson: payload.resolverConfigJson
    }
  });

  await prisma.eventLog.create({
    data: {
      userId: user.id,
      questionId: question.id,
      eventType: requiresDraft ? "question_draft_submitted" : "question_created",
      metadataJson: { noGambling: true }
    }
  });

  return NextResponse.json({ question, requiresDraft });
}
