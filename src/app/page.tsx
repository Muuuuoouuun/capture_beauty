import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { QuestionCard } from "@/components/QuestionCard";

type HomePageProps = {
  searchParams?: {
    category?: string;
    sort?: "closing" | "trending" | "new";
  };
};

const getHomeData = unstable_cache(
  async () => {
    const questions = await prisma.question.findMany({
      where: { status: "OPEN" },
      include: {
        forecasts: { select: { userId: true, probability: true, createdAt: true } },
        rationales: { select: { upvotes: true, createdAt: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 40
    });

    return questions.map((q) => {
      const latestByUser = new Map<string, { createdAt: Date; probability: number }>();
      for (const f of q.forecasts) {
        const current = latestByUser.get(f.userId);
        if (!current || f.createdAt > current.createdAt) {
          latestByUser.set(f.userId, { createdAt: f.createdAt, probability: f.probability });
        }
      }

      const values = [...latestByUser.values()].map((f) => f.probability);
      const communityProbability = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 50;
      const recentForecasts = q.forecasts.filter((f) => Date.now() - +f.createdAt < 24 * 60 * 60 * 1000).length;
      const recentRationaleVotes = q.rationales.reduce((sum, r) => sum + r.upvotes, 0);

      return {
        ...q,
        forecastCount: latestByUser.size,
        communityProbability,
        sparkline: q.forecasts
          .sort((a, b) => +a.createdAt - +b.createdAt)
          .slice(-24)
          .map((f) => ({ at: f.createdAt.toISOString(), probability: f.probability })),
        trendingScore: recentForecasts + recentRationaleVotes
      };
    });
  },
  ["home-data-v2"],
  { revalidate: 120 }
);

export default async function HomePage({ searchParams }: HomePageProps) {
  const category = searchParams?.category;
  const sort = searchParams?.sort ?? "trending";

  const allQuestions = await getHomeData();

  const questions = allQuestions
    .filter((q) => (category ? q.category.toLowerCase() === category.toLowerCase() : true))
    .sort((a, b) => {
      if (sort === "closing") return +a.closeAt - +b.closeAt;
      if (sort === "new") return +b.createdAt - +a.createdAt;
      return b.trendingScore - a.trendingScore;
    })
    .slice(0, 20);

  const categories = [...new Set(allQuestions.map((q) => q.category))];

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Guild Forecasts</h1>
      <p className="text-sm text-ink/80">No wagers. Only probability, calibration rigor, and reputation.</p>

      <div className="parchment-card flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="font-semibold">Filters:</span>
        <a href="/?sort=trending" className="rounded border px-2 py-1 hover:bg-bronze/10">Trending</a>
        <a href="/?sort=closing" className="rounded border px-2 py-1 hover:bg-bronze/10">Closing Soon</a>
        <a href="/?sort=new" className="rounded border px-2 py-1 hover:bg-bronze/10">Newest</a>
        {categories.map((c) => (
          <a key={c} href={`/?category=${encodeURIComponent(c)}&sort=${sort}`} className="rounded border px-2 py-1 hover:bg-bronze/10">
            {c}
          </a>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            id={question.id}
            title={question.title}
            category={question.category}
            closeAt={question.closeAt}
            communityProbability={question.communityProbability}
            sparkline={question.sparkline}
            forecastCount={question.forecastCount}
            trendingScore={question.trendingScore}
          />
        ))}
      </div>
    </div>
  );
}
