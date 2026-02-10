export function BestWorstNarratives({ bestCase, worstCase }: { bestCase: string; worstCase: string }) {
  return (
    <section className="section grid grid-3">
      <div className="card">
        <strong>Best-case narrative</strong>
        <p>{bestCase}</p>
      </div>
      <div className="card">
        <strong>Worst-case narrative</strong>
        <p>{worstCase}</p>
      </div>
    </section>
  );
}
