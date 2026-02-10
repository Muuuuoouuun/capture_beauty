import { Tier } from "@prisma/client";

export function brierScore(probabilityPercent: number, outcome: 0 | 1) {
  const p = probabilityPercent / 100;
  return (p - outcome) ** 2;
}

export function pointsFromBrier(score: number) {
  return Math.round((1 - score) * 120);
}

export function tierFromPerformance(reputationPoints: number, participation: number): Tier {
  if (reputationPoints >= 2200 && participation >= 60) return "ORACLE";
  if (reputationPoints >= 1300 && participation >= 35) return "PROPHET";
  if (reputationPoints >= 800 && participation >= 20) return "MINDSEER";
  if (reputationPoints >= 350 && participation >= 10) return "SIGN_READER";
  return "OBSERVER";
}
