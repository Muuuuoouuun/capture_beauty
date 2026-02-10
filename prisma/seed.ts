import { PrismaClient, Tier } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertBaseUsers() {
  await prisma.user.upsert({
    where: { id: "seed-observer" },
    update: {},
    create: {
      id: "seed-observer",
      email: "observer@oracleguild.local",
      name: "Observer",
      tier: Tier.OBSERVER,
      reputationPoints: 120
    }
  });

  await prisma.user.upsert({
    where: { id: "seed-signreader" },
    update: {},
    create: {
      id: "seed-signreader",
      email: "signreader@oracleguild.local",
      name: "Sign-Reader",
      tier: Tier.SIGN_READER,
      reputationPoints: 600
    }
  });

  await prisma.user.upsert({
    where: { id: "seed-admin" },
    update: {},
    create: {
      id: "seed-admin",
      email: "admin@oracleguild.local",
      name: "Guild Steward",
      tier: Tier.ADMIN,
      reputationPoints: 3000
    }
  });
}

async function upsertQuestionsAndForecasts() {
  const question = await prisma.question.upsert({
    where: { id: "seed-question-fred" },
    update: {},
    create: {
      id: "seed-question-fred",
      title: "Will U.S. unemployment rate be <= 4.0% in the next FRED release?",
      category: "Macro",
      type: "binary",
      outcomesJson: ["YES", "NO"],
      openAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      closeAt: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      resolveExpectedAt: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      status: "OPEN",
      createdBy: "seed-signreader",
      resolverType: "official_api",
      resolverConfigJson: {
        endpoint: "https://api.stlouisfed.org/fred/series/observations",
        queryParams: { series_id: "UNRATE", api_key: "demo", file_type: "json", sort_order: "desc", limit: 1 },
        parsePath: "observations.0.value",
        operator: "<=",
        threshold: 4
      }
    }
  });


  await prisma.forecast.deleteMany({
    where: {
      questionId: question.id,
      userId: { in: ["seed-observer", "seed-signreader", "seed-admin"] }
    }
  });

  await prisma.forecast.createMany({
    data: [
      { questionId: question.id, userId: "seed-observer", probability: 43, confidence: 3 },
      { questionId: question.id, userId: "seed-signreader", probability: 58, confidence: 4 },
      { questionId: question.id, userId: "seed-admin", probability: 49, confidence: 5 }
    ]
  });
}

async function main() {
  await upsertBaseUsers();
  await upsertQuestionsAndForecasts();
}

main().finally(async () => prisma.$disconnect());
