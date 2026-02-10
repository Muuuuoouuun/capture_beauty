import { NextResponse } from "next/server";
import { QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status });
  }

  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "Official source ambiguous");

  const question = await prisma.question.update({
    where: { id: params.id },
    data: { status: QuestionStatus.VOIDED }
  });

  await prisma.eventLog.create({
    data: {
      userId: adminCheck.user.id,
      questionId: params.id,
      eventType: "question_voided",
      metadataJson: { reason }
    }
  });

  return NextResponse.json({ question, reason });
}
