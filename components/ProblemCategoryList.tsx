import Link from "next/link";

const problems = [
  "I have scattered tasks",
  "Team communication breaks",
  "We need lightweight internal tools",
  "Design feedback loops are too slow",
  "Manual handoffs slow us down",
  "Content backlog grows too fast"
];

export function ProblemCategoryList() {
  return (
    <section className="section">
      <h2>Enter by problem context</h2>
      <div className="grid grid-3">
        {problems.map((problem) => (
          <Link
            className="card"
            key={problem}
            href={`/search?problem=${encodeURIComponent(problem)}`}
          >
            <strong>{problem}</strong>
            <p>See tools shaped to this reality.</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
