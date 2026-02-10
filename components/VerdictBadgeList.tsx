import type { VerdictBadges } from "@/lib/types";

const badgeLabels: Record<keyof VerdictBadges, string> = {
  timeSaver: "Time Saver",
  thinkCarefully: "Think Carefully",
  lockinRisk: "Lock-in Risk"
};

export function VerdictBadgeList({ badges }: { badges: VerdictBadges }) {
  return (
    <div className="badge-list" aria-label="Verdict badges">
      {Object.entries(badges).map(([key, value]) =>
        value ? (
          <span className={`badge ${key}`} key={key}>
            {badgeLabels[key as keyof VerdictBadges]}
          </span>
        ) : null
      )}
    </div>
  );
}
