import type { CapabilityComparison } from "@/lib/insights";

export function CapabilityComparisonTable({
  toolName,
  rows
}: {
  toolName: string;
  rows: CapabilityComparison[];
}) {
  return (
    <section className="card">
      <strong>비슷한 툴 비교 (되는 것 / 안 되는 것)</strong>
      <div className="comparison-table" role="table" aria-label="Tool capability comparison table">
        <div className="comparison-head" role="row">
          <span>비교 대상</span>
          <span>{toolName}가 더 잘되는 점</span>
          <span>{toolName}가 약한 점</span>
        </div>
        {rows.map((row) => (
          <div key={row.competitor} className="comparison-row" role="row">
            <strong>{row.competitor}</strong>
            <span>{row.worksBetterHere}</span>
            <span>{row.weakerHere}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
