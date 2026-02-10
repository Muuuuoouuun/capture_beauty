"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Tool } from "@/lib/types";
import { ToolCard } from "@/components/ToolCard";

const badgeOptions = [
  { id: "timeSaver", label: "Time Saver", description: "Speeds execution without heavy overhead." },
  { id: "thinkCarefully", label: "Think Carefully", description: "Demands intentional use to avoid drift." },
  { id: "lockinRisk", label: "Lock-in Risk", description: "Switching costs or data gravity are high." }
] as const;

const formatProblem = (problem: string) => problem.replace(/^I /, "");

export default function SearchClient({
  tools,
  problemContexts
}: {
  tools: Tool[];
  problemContexts: string[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [problem, setProblem] = useState(searchParams.get("problem") ?? "");
  const [badges, setBadges] = useState<string[]>(
    searchParams.get("badges")?.split(",").filter(Boolean) ?? []
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (problem) params.set("problem", problem);
    if (badges.length > 0) params.set("badges", badges.join(","));
    const paramString = params.toString();
    router.replace(paramString ? `/search?${paramString}` : "/search");
  }, [badges, problem, query, router]);

  const results = useMemo(() => {
    const queryLower = query.toLowerCase();
    const problemLower = problem.toLowerCase();

    return tools
      .map((tool) => {
        let score = 0;
        const text = [
          tool.name,
          tool.description,
          tool.whyExist,
          ...tool.problemContexts,
          tool.bestCase,
          tool.worstCase
        ]
          .join(" ")
          .toLowerCase();

        if (queryLower && text.includes(queryLower)) {
          score += 2;
        }
        if (problemLower) {
          const matchesProblem = tool.problemContexts.some((context) =>
            context.toLowerCase().includes(problemLower)
          );
          if (matchesProblem) {
            score += 3;
          }
        }

        const matchesBadges = badges.every(
          (badge) => tool.verdictBadges[badge as keyof Tool["verdictBadges"]]
        );
        if (matchesBadges && badges.length > 0) {
          score += 1;
        }

        return { tool, score };
      })
      .filter(({ score }) => score > 0 || (!query && !problem && badges.length === 0))
      .sort((a, b) => b.score - a.score)
      .map(({ tool }) => tool);
  }, [badges, problem, query, tools]);

  const toggleBadge = (badgeId: string) => {
    setBadges((current) =>
      current.includes(badgeId) ? current.filter((badge) => badge !== badgeId) : [...current, badgeId]
    );
  };

  const clearFilters = () => {
    setQuery("");
    setProblem("");
    setBadges([]);
  };

  return (
    <div className="section">
      <div className="search-panel" aria-label="Search and filter tools">
        <label>
          Search by keyword
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g., scattered tasks, strategy workshops"
            aria-label="Search keyword"
          />
        </label>
        <label>
          Search by problem context
          <input
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            placeholder="e.g., team communication breaks"
            aria-label="Problem context"
          />
        </label>
        <div className="chip-group" role="list" aria-label="Quick problem contexts">
          {problemContexts.map((context) => (
            <button
              type="button"
              className={`chip ${problem === context ? "active" : ""}`}
              key={context}
              onClick={() => setProblem(context)}
            >
              {formatProblem(context)}
            </button>
          ))}
        </div>
        <fieldset>
          <legend>Filter by verdict badges</legend>
          <div className="badge-list badge-filter">
            {badgeOptions.map((badge) => (
              <label key={badge.id} className="badge-option">
                <input
                  type="checkbox"
                  checked={badges.includes(badge.id)}
                  onChange={() => toggleBadge(badge.id)}
                />
                <span>{badge.label}</span>
                <small>{badge.description}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="secondary-button" type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
      <section className="section">
        <h2>Results</h2>
        <p>{results.length} tools match your context.</p>
        {results.length === 0 ? (
          <div className="card">
            <strong>No matches yet</strong>
            <p>Try a different problem statement or remove a verdict filter.</p>
          </div>
        ) : null}
        <div className="grid grid-3">
          {results.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
