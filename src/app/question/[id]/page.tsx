import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ForecastWidget } from "@/components/ForecastWidget";

export default async function QuestionPage({ params }: { params: { id: string } }) {
  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { rationales: { orderBy: { upvotes: "desc" } }, forecasts: { orderBy: { createdAt: "desc" } }, resolution: true }
  });

  if (!question) return notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{question.title}</h1>
      <p className="text-sm">Category: {question.category}</p>
      <p className="text-sm">Closes: {question.closeAt.toLocaleString()}</p>
      <p className="text-sm">Resolution Expected: {question.resolveExpectedAt.toLocaleString()}</p>
      {question.resolution ? (
        <div className="parchment-card border-stamp/40 p-4">
          <p className="text-sm font-semibold">Resolved: {question.resolution.resolvedOutcome}</p>
          <a href={question.resolution.sourceUrl} target="_blank" className="text-sm underline" rel="noreferrer">
            Official source
          </a>
        </div>
      ) : null}

      <ForecastWidget questionId={question.id} />

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Chronicle</h2>
        {question.forecasts.slice(0, 5).map((entry) => (
          <div key={entry.id} className="parchment-card p-3 text-sm">
            Probability shift to {entry.probability}% at {entry.createdAt.toLocaleString()}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Top Rationales</h2>
        {question.rationales.map((rationale) => (
          <article key={rationale.id} className="parchment-card p-3">
            <p>{rationale.text}</p>
            <p className="mt-2 text-xs text-ink/70">▲ {rationale.upvotes} ▼ {rationale.downvotes}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
