"use client";

import { useEffect, useState } from "react";

const storageKey = (toolId: string) => `g2-one-line-review-${toolId}`;

export function OneLineReviewForm({ toolId }: { toolId: string }) {
  const [line, setLine] = useState("");
  const [detail, setDetail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(toolId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as { line: string; detail: string };
    setLine(parsed.line ?? "");
    setDetail(parsed.detail ?? "");
  }, [toolId]);

  const onSave = () => {
    localStorage.setItem(storageKey(toolId), JSON.stringify({ line, detail }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <section className="card">
      <strong>한줄 평 & 리뷰 기록</strong>
      <label>
        한줄 평
        <input
          value={line}
          onChange={(event) => setLine(event.target.value)}
          maxLength={120}
          placeholder="예: PM/개발 협업에 좋지만 구조 설계는 꼭 필요"
        />
      </label>
      <label>
        상세 리뷰
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={4}
          placeholder="실무에서 어떤 상황에서 도움이 됐는지 남겨보세요."
        />
      </label>
      <button className="secondary-button" type="button" onClick={onSave}>
        {saved ? "저장됨" : "리뷰 저장"}
      </button>
    </section>
  );
}
