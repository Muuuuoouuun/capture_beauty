import { QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { brierScore, pointsFromBrier, tierFromPerformance } from "@/lib/scoring";
import { resolvers } from "@/lib/resolvers";

export async function runResolutionSweep() {
  const now = new Date();
  const candidates = await prisma.question.findMany({
    where: {
      status: { in: [QuestionStatus.OPEN, QuestionStatus.CLOSED] },
      resolveExpectedAt: { lte: now }
    },
    include: { forecasts: true }
  });

  const resolvedIds: string[] = [];

  for (const question of candidates) {
    const resolver = resolvers.find((r) => r.canResolve(question));
    if (!resolver) continue;

    const result = await resolver.resolve(question);
    await prisma.resolverRunLog.create({
      data: {
        questionId: question.id,
        resolverType: question.resolverType,
        status: result ? "resolved" : "skipped",
        resultJson: result ?? {}
      }
    });

    if (!result) continue;

    await prisma.$transaction(async (tx) => {
      await tx.resolution.upsert({
        where: { questionId: question.id },
        update: {
          resolvedOutcome: result.outcome,
          resolvedAt: now,
          sourceUrl: result.source_url,
          sourceMetaJson: result.source_meta,
          resolverRunId: `auto-${now.toISOString()}`,
          notes: result.notes
        },
        create: {
          questionId: question.id,
          resolvedOutcome: result.outcome,
          resolvedAt: now,
          sourceUrl: result.source_url,
          sourceMetaJson: result.source_meta,
          resolverRunId: `auto-${now.toISOString()}`,
          notes: result.notes
        }
      });

      await tx.question.update({ where: { id: question.id }, data: { status: QuestionStatus.RESOLVED } });

      const latestByUser = new Map<string, { probability: number }>();
      [...question.forecasts]
        .sort((a, b) => +a.createdAt - +b.createdAt)
        .forEach((f) => latestByUser.set(f.userId, { probability: f.probability }));

      for (const [userId, latest] of latestByUser.entries()) {
        const outcome = result.outcome === "YES" ? 1 : 0;
        const brier = brierScore(latest.probability, outcome as 0 | 1);
        const reward = pointsFromBrier(brier);

        const score = await tx.score.upsert({
          where: { userId },
          update: {
            brierSum: { increment: brier },
            brierCount: { increment: 1 },
            lastResolvedAt: now
          },
          create: {
            userId,
            brierSum: brier,
            brierCount: 1,
            brierAvg: brier,
            lastResolvedAt: now
          }
        });

        const brierAvg = score.brierSum / score.brierCount;
        const participation = score.brierCount;
        const newReputation = reward;

        await tx.score.update({ where: { userId }, data: { brierAvg } });
        const user = await tx.user.update({
          where: { id: userId },
          data: { reputationPoints: { increment: newReputation } }
        });

        const tier = tierFromPerformance(user.reputationPoints + newReputation, participation);
        await tx.user.update({ where: { id: userId }, data: { tier } });
      }
    });

    resolvedIds.push(question.id);
  }

  return { candidates: candidates.length, resolvedIds };
}
