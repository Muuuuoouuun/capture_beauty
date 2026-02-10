import type { WorkPlaybook } from "@/lib/insights";

export function WorkUsageGuide({ playbook }: { playbook: WorkPlaybook[] }) {
  return (
    <section className="card">
      <strong>실무 사용 추천 가이드</strong>
      <div className="grid">
        {playbook.map((item) => (
          <article className="usage-item" key={item.title}>
            <h3>{item.title}</h3>
            <p>
              <strong>어떻게 쓰나:</strong> {item.howToUse}
            </p>
            <p>
              <strong>추천 팁:</strong> {item.recommendation}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
