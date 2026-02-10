"use client";

import { useState } from "react";

const defaultResolver = {
  endpoint: "https://api.stlouisfed.org/fred/series/observations",
  queryParams: { series_id: "UNRATE", api_key: "YOUR_KEY", file_type: "json" },
  parsePath: "observations.0.value",
  operator: "<=",
  threshold: 4.0
};

export default function CreateQuestionPage() {
  const [status, setStatus] = useState<string>();

  async function submit(formData: FormData) {
    const payload = {
      title: String(formData.get("title")),
      category: String(formData.get("category")),
      openAt: String(formData.get("openAt")),
      closeAt: String(formData.get("closeAt")),
      resolveExpectedAt: String(formData.get("resolveExpectedAt")),
      resolverType: String(formData.get("resolverType")),
      resolverConfigJson: JSON.parse(String(formData.get("resolverConfigJson"))),
      status: "OPEN"
    };

    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setStatus(response.ok ? "Question recorded in the guild ledger." : "Could not create question.");
  }

  return (
    <form action={submit} className="space-y-3">
      <h1 className="text-2xl font-semibold">Create a binary question</h1>
      <div className="parchment-card space-y-2 p-3 text-sm text-ink/85">
        <p className="font-semibold">Creation policy</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>No gambling language, no bets, no staking, no cash-out mechanics.</li>
          <li>Questions must include clear YES/NO criteria and official resolution source.</li>
          <li>Lower tiers may be drafted/reviewed by moderators before opening.</li>
        </ul>
      </div>

      <input name="title" required placeholder="Will CPI YoY be below 3.0% by Dec 2026?" className="w-full rounded border p-2" />
      <input name="category" required placeholder="Macro" className="w-full rounded border p-2" />
      <div className="grid gap-3 md:grid-cols-3">
        <input type="datetime-local" name="openAt" required className="rounded border p-2" />
        <input type="datetime-local" name="closeAt" required className="rounded border p-2" />
        <input type="datetime-local" name="resolveExpectedAt" required className="rounded border p-2" />
      </div>
      <select name="resolverType" className="rounded border p-2">
        <option value="official_api">Official API Resolver</option>
        <option value="official_link">Official Link Resolver</option>
      </select>
      <textarea name="resolverConfigJson" rows={8} className="w-full rounded border p-2 font-mono text-xs" defaultValue={JSON.stringify(defaultResolver, null, 2)} />
      <button className="rounded bg-bronze px-4 py-2 text-white">Create</button>
      {status ? <p className="text-sm">{status}</p> : null}
    </form>
  );
}
