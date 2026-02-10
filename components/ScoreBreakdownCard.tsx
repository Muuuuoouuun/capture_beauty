import type { ScoreBreakdown } from "@/lib/insights";

const labels: Record<keyof ScoreBreakdown, string> = {
  functionality: "기능 완성도",
  uiux: "UI/UX",
  reliability: "에러/안정성",
  comfort: "쾌적도",
  pricing: "가격 합리성"
};

export function ScoreBreakdownCard({
  totalScore,
  scoreBreakdown
}: {
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
}) {
  return (
    <section className="card">
      <strong>리뷰 총점</strong>
      <p className="total-score">{totalScore} / 100</p>
      <div className="score-grid">
        {Object.entries(scoreBreakdown).map(([key, value]) => (
          <div key={key} className="score-row">
            <span>{labels[key as keyof ScoreBreakdown]}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
