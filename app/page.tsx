import { Hero } from "@/components/Hero";
import { PrinciplesBar } from "@/components/PrinciplesBar";
import { ProblemCategoryList } from "@/components/ProblemCategoryList";
import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/tools";

export default function HomePage() {
  const featured = tools.slice(0, 3);

  return (
    <main>
      <Hero />
      <PrinciplesBar />
      <ProblemCategoryList />
      <section className="section">
        <h2>Featured judgment reviews</h2>
        <div className="grid grid-3">
          {featured.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </main>
  );
}
