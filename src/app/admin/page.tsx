import { prisma } from "@/lib/db";

export default async function AdminPage() {
  const [needsReview, recentEvents, admins] = await Promise.all([
    prisma.question.findMany({ where: { status: { in: ["OPEN", "CLOSED"] } }, take: 20, orderBy: { closeAt: "asc" } }),
    prisma.eventLog.findMany({ where: { eventType: { in: ["question_voided", "question_created", "forecast_submitted"] } }, take: 15, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { tier: "ADMIN" }, select: { id: true, name: true, email: true, createdAt: true } })
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Moderation & Resolution Desk</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="parchment-card p-4">
          <p className="text-xs uppercase text-ink/60">Admin Accounts</p>
          <p className="text-2xl font-semibold">{admins.length}</p>
          <p className="text-xs text-ink/70">Use bootstrap API to promote trusted operators.</p>
        </div>
        <div className="parchment-card p-4">
          <p className="text-xs uppercase text-ink/60">Review Queue</p>
          <p className="text-2xl font-semibold">{needsReview.length}</p>
          <p className="text-xs text-ink/70">Open/closed questions awaiting moderation checks.</p>
        </div>
        <div className="parchment-card p-4">
          <p className="text-xs uppercase text-ink/60">Policy</p>
          <p className="text-sm">No betting, no cash-out, no stakes. Reputation only.</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Questions to monitor</h2>
        {needsReview.map((q) => (
          <div key={q.id} className="parchment-card p-4">
            <p className="font-semibold">{q.title}</p>
            <p className="text-xs text-ink/70">{q.category} · closes {q.closeAt.toLocaleString()} · resolver {q.resolverType}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recent governance events</h2>
        {recentEvents.map((event) => (
          <div key={event.id} className="parchment-card p-3 text-sm">
            <p className="font-semibold">{event.eventType}</p>
            <p className="text-xs text-ink/70">{event.createdAt.toLocaleString()}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
