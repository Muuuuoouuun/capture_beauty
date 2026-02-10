"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatchNote } from "@/lib/insights";

const storageKey = (toolId: string) => `g2-company-patch-notes-${toolId}`;

export function PatchNotesSection({
  toolId,
  notes
}: {
  toolId: string;
  notes: PatchNote[];
}) {
  const [title, setTitle] = useState("");
  const [change, setChange] = useState("");
  const [errorRisk, setErrorRisk] = useState("");
  const [localNotes, setLocalNotes] = useState<PatchNote[]>([]);

  const combinedNotes = useMemo(() => [...localNotes, ...notes], [localNotes, notes]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(toolId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as PatchNote[];
    setLocalNotes(parsed);
  }, [toolId]);

  const onAdd = () => {
    if (!title || !change || !errorRisk) return;
    const entry: PatchNote = {
      date: new Date().toISOString().slice(0, 10),
      title,
      change,
      errorRisk
    };
    const next = [entry, ...localNotes];
    setLocalNotes(next);
    localStorage.setItem(storageKey(toolId), JSON.stringify(next));
    setTitle("");
    setChange("");
    setErrorRisk("");
  };

  return (
    <section className="card">
      <strong>굵직한 패치 / 에러 변경사항</strong>
      <p>회사 담당자가 실제 운영 이슈를 남길 수 있습니다.</p>
      <div className="grid">
        {combinedNotes.map((note, index) => (
          <article key={`${note.date}-${note.title}-${index}`} className="patch-note-item">
            <small>{note.date}</small>
            <h3>{note.title}</h3>
            <p>
              <strong>변경사항:</strong> {note.change}
            </p>
            <p>
              <strong>에러/리스크:</strong> {note.errorRisk}
            </p>
          </article>
        ))}
      </div>
      <div className="grid">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="패치 제목"
        />
        <textarea
          value={change}
          onChange={(event) => setChange(event.target.value)}
          rows={3}
          placeholder="무엇이 변경되었나요?"
        />
        <textarea
          value={errorRisk}
          onChange={(event) => setErrorRisk(event.target.value)}
          rows={3}
          placeholder="발생한 에러나 영향도를 적어주세요"
        />
        <button className="secondary-button" type="button" onClick={onAdd}>
          변경사항 추가
        </button>
      </div>
    </section>
  );
}
