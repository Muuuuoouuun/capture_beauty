import Link from "next/link";
import type { Tool } from "@/lib/types";
import { VerdictBadgeList } from "@/components/VerdictBadgeList";

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <div className="card">
      <div>
        <strong>{tool.name}</strong>
        <p>{tool.description}</p>
      </div>
      <VerdictBadgeList badges={tool.verdictBadges} />
      <div>
        <Link href={`/tools/${tool.id}`}>Read judgment review →</Link>
      </div>
    </div>
  );
}
