import SearchClient from "@/app/search/SearchClient";
import { tools } from "@/data/tools";

export default function SearchPage() {
  const problemContexts = Array.from(new Set(tools.flatMap((tool) => tool.problemContexts))).slice(0, 8);

  return (
    <main>
      <section className="section">
        <h1>Search by situation, not category</h1>
        <p>
          Tell us the problem that keeps showing up. We surface tools with judgment calls and human impact in
          mind.
        </p>
      </section>
      <SearchClient tools={tools} problemContexts={problemContexts} />
    </main>
  );
}
