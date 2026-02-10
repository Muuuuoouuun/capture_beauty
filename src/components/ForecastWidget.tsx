"use client";

import { useState } from "react";

export function ForecastWidget({ questionId }: { questionId: string }) {
  const [probability, setProbability] = useState(50);
  const [confidence, setConfidence] = useState(3);
  const [status, setStatus] = useState<string>();

  async function submitForecast() {
    const response = await fetch("/api/forecasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, probability, confidence })
    });

    setStatus(response.ok ? "Forecast inscribed in the archive." : "Submission failed.");
  }

  return (
    <div className="parchment-card p-4">
      <p className="text-sm text-ink/80">Declare your probability</p>
      <input
        type="range"
        min={0}
        max={100}
        value={probability}
        onChange={(e) => setProbability(Number(e.target.value))}
        className="w-full"
      />
      <p className="text-lg font-semibold">{probability}% YES</p>
      <label className="text-sm">Confidence (1-5)</label>
      <input
        type="number"
        min={1}
        max={5}
        value={confidence}
        onChange={(e) => setConfidence(Number(e.target.value))}
        className="mt-1 w-20 rounded border px-2 py-1"
      />
      <button onClick={submitForecast} className="mt-3 rounded bg-bronze px-3 py-2 text-sm text-white">
        Submit Forecast
      </button>
      {status ? <p className="mt-2 text-sm">{status}</p> : null}
    </div>
  );
}
