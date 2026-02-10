import type { Tool } from "@/lib/types";
import { VerdictBadgeList } from "@/components/VerdictBadgeList";

export function ToolHeader({ tool }: { tool: Tool }) {
  return (
    <section className="card">
      <h1>{tool.name}</h1>
      <p>{tool.description}</p>
      <div className="badge-list" aria-label="Problem contexts">
        {tool.problemContexts.map((context) => (
          <span className="badge context-badge" key={context}>
            {context}
          </span>
        ))}
      </div>
      <VerdictBadgeList badges={tool.verdictBadges} />
    </section>
  );
}
