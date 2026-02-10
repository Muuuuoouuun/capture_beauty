import { Question } from "@prisma/client";

export type ResolverResult = {
  outcome: "YES" | "NO";
  source_url: string;
  source_meta: Record<string, unknown>;
  notes?: string;
};

export interface Resolver {
  canResolve(question: Question): boolean;
  resolve(question: Question): Promise<ResolverResult | null>;
}

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

export class OfficialApiResolver implements Resolver {
  canResolve(question: Question) {
    return question.resolverType === "official_api";
  }

  async resolve(question: Question) {
    const cfg = question.resolverConfigJson as any;
    const url = new URL(cfg.endpoint);
    if (cfg.queryParams) {
      Object.entries(cfg.queryParams).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }

    const response = await fetch(url.toString(), { headers: cfg.headers ?? {} });
    if (!response.ok) return null;

    const payload = await response.json();
    const value = getByPath(payload, cfg.parsePath || "");
    const threshold = Number(cfg.threshold ?? 0);
    const operator = cfg.operator ?? ">=";

    const passed =
      operator === ">=" ? Number(value) >= threshold :
      operator === ">" ? Number(value) > threshold :
      operator === "<=" ? Number(value) <= threshold :
      operator === "<" ? Number(value) < threshold :
      String(value) === String(threshold);

    return {
      outcome: passed ? "YES" : "NO",
      source_url: url.toString(),
      source_meta: { value, threshold, operator }
    };
  }
}

export class OfficialLinkResolver implements Resolver {
  canResolve(question: Question) {
    return question.resolverType === "official_link";
  }

  async resolve(question: Question) {
    const cfg = question.resolverConfigJson as any;
    if (!cfg.sourceUrl || !cfg.manualOutcome) return null;

    return {
      outcome: cfg.manualOutcome,
      source_url: cfg.sourceUrl,
      source_meta: { enteredBy: cfg.enteredBy ?? "admin" },
      notes: cfg.notes
    };
  }
}

export const resolvers: Resolver[] = [new OfficialApiResolver(), new OfficialLinkResolver()];
