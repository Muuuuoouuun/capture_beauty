const principles = [
  {
    title: "Judgment over hype",
    description: "We explain the trade-offs hidden behind shiny features."
  },
  {
    title: "Human impact first",
    description: "Time, cognition, and collaboration matter more than speed."
  },
  {
    title: "Context is the filter",
    description: "Tools are reviewed by the problem they solve, not their category."
  }
];

export function PrinciplesBar() {
  return (
    <section className="section">
      <h2>Core principles</h2>
      <div className="grid grid-3">
        {principles.map((principle) => (
          <div className="card" key={principle.title}>
            <strong>{principle.title}</strong>
            <p>{principle.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
