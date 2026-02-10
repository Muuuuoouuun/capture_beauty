export default function AboutPage() {
  return (
    <main>
      <section className="hero">
        <h1>About g2</h1>
        <p>
          g2 exists because software choices are really judgment calls. We review tools by how they reshape
          focus, collaboration, and long-term decision quality.
        </p>
      </section>
      <section className="section">
        <h2>What makes g2 different</h2>
        <div className="grid grid-3">
          <div className="card">
            <strong>Human impact scorecards</strong>
            <p>Every review maps how a tool changes cognition, speed, and clarity.</p>
          </div>
          <div className="card">
            <strong>Scenario narratives</strong>
            <p>Best- and worst-case stories help teams spot unintended consequences.</p>
          </div>
          <div className="card">
            <strong>Judgment badges</strong>
            <p>We flag tools that save time, require caution, or introduce lock-in risk.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
