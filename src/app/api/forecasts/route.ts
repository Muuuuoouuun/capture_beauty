import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forecastSchema } from "@/lib/validation";

const rateMap = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const recent = (rateMap.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  rateMap.set(userId, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const body = await req.json();
  const payload = forecastSchema.parse(body);

  const userId = req.headers.get("x-user-id") ?? "seed-observer";
  if (isRateLimited(userId)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const question = await prisma.question.findUnique({ where: { id: payload.questionId } });
  if (!question || question.status !== "OPEN" || question.closeAt < new Date()) {
    return NextResponse.json({ error: "Question is closed" }, { status: 400 });
  }

  const latest = await prisma.forecast.findFirst({
    where: { questionId: payload.questionId, userId },
    orderBy: { createdAt: "desc" }
  });

  if (latest && Math.abs(latest.probability - payload.probability) < 0.01) {
    return NextResponse.json({ error: "Same probability as latest forecast" }, { status: 400 });
  }

  if (latest && Date.now() - +latest.createdAt < 30_000) {
    return NextResponse.json({ error: "Please wait before updating again" }, { status: 429 });
  }

  const forecast = await prisma.forecast.create({
    data: {
      questionId: payload.questionId,
      userId,
      probability: payload.probability,
      confidence: payload.confidence,
      updatedFromId: payload.updatedFromId ?? latest?.id
    }
  });

  await prisma.eventLog.create({
    data: {
      userId,
      questionId: payload.questionId,
      eventType: "forecast_submitted",
      metadataJson: { probability: payload.probability, confidence: payload.confidence }
    }
  });

  return NextResponse.json({ forecast });
}
