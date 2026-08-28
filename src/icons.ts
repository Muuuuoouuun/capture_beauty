/**
 * 공용 라인 아이콘 세트 — 이모지 혼용 대신 일관된 스트로크 SVG.
 * 24×24 viewBox · stroke: currentColor · 둥근 캡. 콘텐츠 성격의 이모지
 * (룩/도장 프리셋 이름 등)는 그대로 두고, 크롬(버튼/칩)에만 사용한다.
 */

const PATHS = {
  camera:
    '<rect x="3.5" y="7" width="17" height="12.5" rx="3"/><circle cx="12" cy="13" r="3.2"/><path d="M9.5 7l1-2h3l1 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h3.6l2 2.4h7.4a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  clipboard:
    '<rect x="5.5" y="4.5" width="13" height="16.5" rx="2.2"/><path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>',
  link:
    '<path d="M10 13.5a4.5 4.5 0 0 0 6.6.5l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4"/><path d="M14 10.5a4.5 4.5 0 0 0-6.6-.5l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4"/>',
  pin: '<path d="M9.5 4h5l-.7 5.5 2.7 2V13H7.5v-1.5l2.7-2z"/><path d="M12 13v7.5"/>',
  zap: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  sliders:
    '<path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15"/><circle cx="9.5" cy="7.5" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="8" cy="16.5" r="1.8"/>',
  download: '<path d="M12 4v10.5M8 11l4 4 4-4"/><path d="M5 20h14"/>',
  copy:
    '<rect x="9" y="9" width="11.5" height="11.5" rx="2.2"/><path d="M15 9V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H9"/>',
  pencil: '<path d="M16.8 3.7 20.3 7.2 8 19.5l-4.6 1.1L4.5 16z"/>',
  undo: '<path d="M8.5 14 3.5 9l5-5"/><path d="M3.5 9H14a6.5 6.5 0 0 1 0 13h-3"/>',
  eraser:
    '<path d="M9.5 19.5 4 14a2 2 0 0 1 0-2.8l7.3-7.3a2 2 0 0 1 2.8 0l5.9 5.9a2 2 0 0 1 0 2.8l-6.9 6.9z"/><path d="M9.5 19.5H20"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M7 6.5l1 14h8l1-14"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  crop: '<path d="M6.5 2.5v13a2 2 0 0 0 2 2h13"/><path d="M2.5 6.5h13a2 2 0 0 1 2 2v13"/>',
  floppy:
    '<path d="M5 3.5h11l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M8 3.5V8.5h7"/><path d="M7.5 20v-6h9v6"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 16): string {
  return (
    `<svg class="icn" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    PATHS[name] +
    `</svg>`
  );
}

/** 버튼 내용을 아이콘(+라벨)으로 설정. 라벨은 이후 setLabel 로 갱신 가능 */
export function applyIcon(el: HTMLElement, name: IconName, label?: string, size = 16): void {
  el.innerHTML = icon(name, size) + (label !== undefined ? `<span class="lbl"></span>` : "");
  if (label !== undefined) el.querySelector(".lbl")!.textContent = label;
}

export function setLabel(el: HTMLElement, text: string): void {
  const lbl = el.querySelector<HTMLElement>(".lbl");
  if (lbl) lbl.textContent = text;
  else el.textContent = text;
}
