import type { ImpactScores } from "@/lib/types";

const labels: Record<keyof ImpactScores, string> = {
  judgmentSpeed: "Judgment speed",
  thinkingDepth: "Thinking depth",
  executionDensity: "Execution density",
  collaborationClarity: "Collaboration clarity"
};

export function ImpactMeterGrid({ impact }: { impact: ImpactScores }) {
  return (
    <section className="card">
      <strong>Human impact radar</strong>
      <div className="impact-grid">
        {Object.entries(impact).map(([key, value]) => (
          <div className="impact-item" key={key}>
            <label htmlFor={`impact-${key}`}>{labels[key as keyof ImpactScores]}</label>
            <meter id={`impact-${key}`} min={0} max={10} value={value} />
            <span>{value}/10</span>
          </div>
        ))}
      </div>
    </section>
  );
}
