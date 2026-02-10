import { notFound } from "next/navigation";
import { tools } from "@/data/tools";
import { ToolHeader } from "@/components/ToolHeader";
import { ImpactMeterGrid } from "@/components/ImpactMeterGrid";
import { BestWorstNarratives } from "@/components/BestWorstNarratives";
import { AlternativesSection } from "@/components/AlternativesSection";
import { ToolCard } from "@/components/ToolCard";
import { ScoreBreakdownCard } from "@/components/ScoreBreakdownCard";
import { CapabilityComparisonTable } from "@/components/CapabilityComparisonTable";
import { PatchNotesSection } from "@/components/PatchNotesSection";
import { OneLineReviewForm } from "@/components/OneLineReviewForm";
import { WorkUsageGuide } from "@/components/WorkUsageGuide";
import { getToolInsight } from "@/lib/insights";

export default function ToolReviewPage({ params }: { params: { id: string } }) {
  const tool = tools.find((item) => item.id === params.id);
  if (!tool) {
    notFound();
  }

  const related = tools.filter((item) => item.id !== tool.id).slice(0, 3);
  const insight = getToolInsight(tool);

  return (
    <main>
      <ToolHeader tool={tool} />
      <section className="section card">
        <strong>Why this tool exists</strong>
        <p>{tool.whyExist}</p>
      </section>
      <ScoreBreakdownCard totalScore={insight.totalScore} scoreBreakdown={insight.scoreBreakdown} />
      <section className="card">
        <strong>한줄 총평</strong>
        <p>{insight.oneLine}</p>
      </section>
      <ImpactMeterGrid impact={tool.impact} />
      <BestWorstNarratives bestCase={tool.bestCase} worstCase={tool.worstCase} />
      <CapabilityComparisonTable toolName={tool.name} rows={insight.comparisons} />
      <AlternativesSection alternatives={tool.alternatives} />
      <WorkUsageGuide playbook={insight.workPlaybook} />
      <OneLineReviewForm toolId={tool.id} />
      <PatchNotesSection toolId={tool.id} notes={insight.patchNotes} />
      <section className="section">
        <h2>Related tools</h2>
        <div className="grid grid-3">
          {related.map((item) => (
            <ToolCard key={item.id} tool={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
