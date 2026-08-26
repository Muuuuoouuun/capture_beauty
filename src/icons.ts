/**
 * 공용 라인 아이콘 세트 — 이모지 혼용 대신 일관된 스트로크 SVG.
 * 24×24 viewBox · stroke: currentColor · 둥근 캡. 콘텐츠 성격의 이모지
 * (룩/도장 프리셋 이름 등)는 그대로 두고, 크롬(버튼/칩)에만 사용한다.
 */

const PATHS = {
  camera:
    '<rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.2-2.4A1 1 0 0 1 11.1 4h1.8a1 1 0 0 1 .9.6L15 7"/>',
  gear:
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clipboard:
    '<rect x="5" y="4.5" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="4" rx="1.2"/>',
  link:
    '<path d="M10 13.5a4.5 4.5 0 0 0 6.6.5l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4"/><path d="M14 10.5a4.5 4.5 0 0 0-6.6-.5l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4"/>',
  pin:
    '<path d="M9 3.5h6l-1 6 3.5 2.5v1.5H6.5V12L10 9.5z"/><path d="M12 13.5V21"/>',
  zap: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  sliders:
    '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--panel-2,#23232f)"/><circle cx="15" cy="12" r="2" fill="var(--panel-2,#23232f)"/><circle cx="7.5" cy="17" r="2" fill="var(--panel-2,#23232f)"/>',
  download: '<path d="M12 3.5V15M7.5 10.5l4.5 4.5 4.5-4.5"/><path d="M4.5 20.5h15"/>',
  copy:
    '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  pencil: '<path d="M16.5 3.5 20.5 7.5 8 20l-5 1 1-5z"/><path d="M14.5 5.5l4 4"/>',
  undo: '<path d="M8.5 14 3.5 9l5-5"/><path d="M3.5 9H14a6.5 6.5 0 0 1 0 13h-3"/>',
  eraser:
    '<path d="M9.5 20 3.8 14.3a2 2 0 0 1 0-2.8l7.5-7.5a2 2 0 0 1 2.8 0l6 6a2 2 0 0 1 0 2.8L13 20z"/><path d="M9.5 20H20"/><path d="M8 9.5l6.5 6.5"/>',
  trash: '<path d="M4 6.5h16M9 6.5v-2h6v2M6.5 6.5 7.5 21h9l1-14.5"/><path d="M10 10.5v6.5M14 10.5v6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  crop: '<path d="M6.5 2.5v13a2 2 0 0 0 2 2h13"/><path d="M2.5 6.5h13a2 2 0 0 1 2 2v13"/>',
  floppy:
    '<path d="M5 3.5h11l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M8 3.5V9h7V3.5"/><rect x="7.5" y="13.5" width="9" height="8" rx="1"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 16): string {
  return (
    `<svg class="icn" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
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
