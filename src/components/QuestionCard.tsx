import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ProbabilitySparkline } from "@/components/ProbabilitySparkline";

type QuestionCardProps = {
  id: string;
  title: string;
  category: string;
  closeAt: Date;
  communityProbability: number;
  sparkline: Array<{ at: string; probability: number }>;
  forecastCount: number;
  trendingScore: number;
};

export function QuestionCard({
  id,
  title,
  category,
  closeAt,
  communityProbability,
  sparkline,
  forecastCount,
  trendingScore
}: QuestionCardProps) {
  return (
    <div className="parchment-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-bronze">{category}</p>
        <span className="guild-badge">Trending {trendingScore}</span>
      </div>
      <Link href={`/question/${id}`} className="text-lg font-semibold hover:underline">
        {title}
      </Link>
      <p className="mt-1 text-sm text-ink/80">Guild probability: {communityProbability.toFixed(1)}%</p>
      <ProbabilitySparkline data={sparkline} />
      <div className="mt-1 flex items-center justify-between text-xs text-ink/70">
        <p>{forecastCount} active forecasters</p>
        <p>Closes {formatDistanceToNow(closeAt, { addSuffix: true })}</p>
      </div>
    </div>
  );
}
