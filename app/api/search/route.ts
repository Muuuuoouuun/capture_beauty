import { searchTools } from "@/lib/tools";
import type { VerdictBadges } from "@/lib/types";

const parseBadges = (badgesParam: string | null): Partial<VerdictBadges> | undefined => {
  if (!badgesParam) return undefined;
  const badges: Partial<VerdictBadges> = {};
  badgesParam.split(",").forEach((badge) => {
    if (badge === "timeSaver") badges.timeSaver = true;
    if (badge === "thinkCarefully") badges.thinkCarefully = true;
    if (badge === "lockinRisk") badges.lockinRisk = true;
  });
  return badges;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const problem = searchParams.get("problem") ?? undefined;
  const badges = parseBadges(searchParams.get("badges"));

  const tools = searchTools({ query, problem, badges });
  return Response.json({ tools }, { status: 200 });
}
