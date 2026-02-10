export function AlternativesSection({ alternatives }: { alternatives: string[] }) {
  return (
    <section className="card">
      <strong>Alternative paths</strong>
      <ul>
        {alternatives.map((alternative) => (
          <li key={alternative}>{alternative}</li>
        ))}
      </ul>
    </section>
  );
}
