import type { BackgroundOptions, FilterParams, Stamp } from "./types";
import { defaultFilterParams, FILTER_PRESETS, presetToParams } from "./filters";
import {
  BACKGROUND_PRESETS,
  defaultBackgroundOptions,
  detectTrim,
  hasTrim,
  RATIO_CHOICES,
  SMART_BACKGROUND_FILTERS,
} from "./background";
import {
  createStamp,
  DATE_FORMATS,
  STAMP_EMOJIS,
  STAMP_PRESETS,
  STAMP_STYLE_NAMES,
  stampDisplayText,
  drawStamp,
} from "./stamps";
import {
  ANNOTATION_TOOLS,
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_ANNOTATION_SIZE,
  annotationBox,
  createAnnotation,
  drawAnnotations,
  hitTestAnnotation,
  isDegenerate,
  type Annotation,
  type AnnotationKind,
} from "./annotations";
import {
  ACTION_GROUPS,
  ACTIONS,
  formatCombo,
  ShortcutManager,
  type ActionId,
} from "./shortcuts";
import { loadSettings, saveSettings, type AppSettings } from "./settings";
import { canvasFromBlob, canvasFromClipboard, canvasFromDataUrl, captureScreen } from "./capture";
import {
  cropCanvas,
  cropCanvasRect,
  downscaleCanvas,
  invalidateFilterCache,
  rawFromCanvas,
  renderComposite,
  scaleCanvasToWidth,
  type RenderResult,
} from "./render";
import { selectRegion } from "./region";
import {
  canvasToAnalysisBase64,
  canvasToBlob,
  copyCanvasToClipboard,
  downloadBlob,
  downloadCanvas,
  exportFileName,
  type ExportFormat,
} from "./exporter";
import { CaptureSession, type QuickSettings } from "./quickcapture";
import { isWidgetSupported, openWidget, type WidgetHandle } from "./widget";
import { getNative } from "./native";
import { applyIcon, icon, setLabel } from "./icons";
import { getLook, LOOKS, pickRandomLook, RANDOM_LOOK_ID, type LookDef } from "./looks";
import {
  buildProfile,
  cloneProfileStamps,
  LAST_PROFILE_ID,
  MAX_PROFILES,
  type CaptureProfile,
} from "./profiles";
// AI 목록은 가볍게 정적으로, 무거운 SDK(ai.ts)는 실제 호출 시에만 동적 로드
import { AI_FILTERS } from "./ai-filters";

/* =========================================================
 * 상태
 * ========================================================= */

let baseCanvas: HTMLCanvasElement | null = null; // 풀해상도 원본 (트림/변환은 여기 반영)
let baseVersion = 0;
let previewSource: HTMLCanvasElement | null = null; // 미리보기용 축소본 캐시
let filters: FilterParams = defaultFilterParams();
let bg: BackgroundOptions = defaultBackgroundOptions();
let stamps: Stamp[] = [];
let selectedStampId: string | null = null;
/** 주석 레이어 (화살표·박스·형광펜·모자이크) */
let annotations: Annotation[] = [];
let selectedAnnotationId: string | null = null;
/** 선택된 주석 도구 — null 이면 선택/이동 모드 */
let activeTool: AnnotationKind | null = null;
let annoColor = DEFAULT_ANNOTATION_COLOR;
let annoSize = DEFAULT_ANNOTATION_SIZE;
let activeFilterPresetId = "none";
const history: HTMLCanvasElement[] = []; // 파괴적 작업(트림/AI 변환/새 이미지) 되돌리기
const MAX_HISTORY = 10;

const settings: AppSettings = loadSettings();
const manager = new ShortcutManager(settings.shortcuts ?? undefined);
const session = new CaptureSession();
let widget: WidgetHandle | null = null;

/** 홈 덱: 선택된 촬영 스타일(룩 또는 내 프리셋 — 매 샷에 적용) + 다음 샷 대기 중인 도장들 */
let selectedLookId = "look-none";
const armedStampIds = new Set<string>();
/** 내보내기 가로 크기 (px, 0 = 원본) */
let outputWidth = 0;

const PREVIEW_MAX_DIM = 1600;
/** 슬라이더를 끄는 동안 쓰는 저해상도 소스 — 픽셀 연산량을 ~4배 줄여 즉시 반응하게 한다 */
const PREVIEW_FAST_DIM = 820;
let previewSourceFast: HTMLCanvasElement | null = null;
let fastPreview = false;

/* =========================================================
 * DOM 헬퍼
 * ========================================================= */

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

const previewEl = $<HTMLCanvasElement>("#preview");
const overlayEl = $<HTMLCanvasElement>("#preview-overlay");
const emptyState = $("#empty-state");
const canvasWrap = $("#canvas-wrap");
const statusbar = $("#statusbar");
const cameraPreviewEl = $<HTMLCanvasElement>("#camera-preview");
const vfHint = $("#vf-hint");
const captureActions = $("#capture-actions");
const editorBackdrop = $("#editor-backdrop");
const editorWindow = $("#editor-window");
const settingsBackdrop = $("#settings-backdrop");

function toast(message: string, kind: "info" | "success" | "error" = "info"): void {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind === "info" ? "" : kind}`.trim();
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

async function withBusy<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const overlay = $("#busy-overlay");
  $("#busy-message").textContent = message;
  overlay.hidden = false;
  try {
    return await fn();
  } finally {
    overlay.hidden = true;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/* =========================================================
 * 모드 전환 — 캡처 화면(카메라) ↔ 편집기(프로그램 창)
 * ========================================================= */

function isEditorOpen(): boolean {
  return !editorBackdrop.hidden;
}

function openEditor(tab?: string): void {
  editorBackdrop.hidden = false;
  // 첫 오픈 시 화면 중앙에 배치 (이후엔 사용자가 옮긴 위치 유지)
  if (!editorWindow.style.left) {
    editorWindow.style.left = `${Math.max(0, (window.innerWidth - editorWindow.offsetWidth) / 2)}px`;
    editorWindow.style.top = `${Math.max(0, (window.innerHeight - editorWindow.offsetHeight) / 2)}px`;
  }
  if (tab) switchTab(tab);
  requestRender();
}

function closeEditor(): void {
  editorBackdrop.hidden = true;
}

function toggleEditor(): void {
  if (isEditorOpen()) closeEditor();
  else openEditor();
}

/* ---------- 설정 창 (앱 전역 설정 — 편집과 분리) ---------- */

type SettingsSection = "capture" | "keys" | "connect";

function isSettingsOpen(): boolean {
  return !settingsBackdrop.hidden;
}

function openSettings(section?: SettingsSection): void {
  settingsBackdrop.hidden = false;
  if (section) switchSettingsSection(section);
}

function closeSettings(): void {
  settingsBackdrop.hidden = true;
  cancelRecording?.();
}

function toggleSettings(): void {
  if (isSettingsOpen()) closeSettings();
  else openSettings();
}

function switchSettingsSection(name: SettingsSection): void {
  document.querySelectorAll<HTMLButtonElement>(".sect").forEach((b) => {
    b.classList.toggle("active", b.dataset.sect === name);
  });
  document.querySelectorAll<HTMLElement>(".sect-panel").forEach((p) => {
    p.classList.toggle("active", p.dataset.sectPanel === name);
  });
}

/** 사진기 셔터 플래시 효과 */
function fireShutterFlash(): void {
  const flash = $("#shutter-flash");
  flash.classList.remove("firing");
  // 리플로우로 애니메이션 재시작
  void flash.offsetWidth;
  flash.classList.add("firing");
}

/* =========================================================
 * 렌더링
 * ========================================================= */

let lastRender: RenderResult | null = null;
let renderQueued = false;

function requestRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function renderPreview(): void {
  if (!previewSource || !baseCanvas) return;
  const source = (fastPreview && previewSourceFast) || previewSource;
  const result = renderComposite(
    { source, filters, background: bg, stamps, annotations },
    `${source === previewSource ? "prev" : "fast"}-${baseVersion}`,
  );
  lastRender = result;
  previewEl.width = result.canvas.width;
  previewEl.height = result.canvas.height;
  previewEl.getContext("2d")!.drawImage(result.canvas, 0, 0);
  // 카메라 뷰파인더에도 같은 결과 표시 (찍은 사진 리뷰 — 선택 표시는 제외)
  cameraPreviewEl.width = result.canvas.width;
  cameraPreviewEl.height = result.canvas.height;
  cameraPreviewEl.getContext("2d")!.drawImage(result.canvas, 0, 0);
  drawOverlay();
  updateStatus(result, source);
}

/* ---------- 오버레이 — 선택 표시 / 드래그 중인 요소 (합성 재실행 없음) ---------- */

/** 그리는 중인 주석 (아직 확정 전) */
let draftAnnotation: Annotation | null = null;
/** 드래그 중인 스탬프 id */
let draggingStampId: string | null = null;

function drawOverlay(): void {
  if (!lastRender) return;
  if (overlayEl.width !== previewEl.width || overlayEl.height !== previewEl.height) {
    overlayEl.width = previewEl.width;
    overlayEl.height = previewEl.height;
  }
  const ctx = overlayEl.getContext("2d")!;
  ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);
  const rect = lastRender.imageRect;

  if (draftAnnotation) {
    drawDraft(ctx, draftAnnotation, rect);
    return;
  }
  if (draggingStampId) {
    const s = stamps.find((st) => st.id === draggingStampId);
    if (s) {
      const b = drawStamp(ctx, s, rect.x, rect.y, rect.w, rect.h, new Date());
      drawImageFrame(ctx, rect);
      drawMarquee(ctx, b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h, true);
    }
    return;
  }
  drawSelectionDecor(ctx);
}

/**
 * 그리는 중 미리보기. 모자이크는 오버레이에 원본 픽셀이 없어 실제 효과를 낼 수 없으므로
 * 점선 마퀴로 영역만 보여주고, 확정 시 합성 단계에서 진짜 모자이크가 들어간다.
 */
function drawDraft(ctx: CanvasRenderingContext2D, a: Annotation, rect: RenderResult["imageRect"]): void {
  if (a.kind === "mosaic") {
    const b = annotationBox(a, rect);
    ctx.save();
    ctx.fillStyle = "rgba(180,180,200,0.28)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
    drawMarquee(ctx, b.x, b.y, b.w, b.h, false);
    return;
  }
  drawAnnotations(ctx, [a], rect);
}

/** 애플 캡처 느낌의 점선 선택 표시 — 오버레이 전용 (내보내기에는 없음) */
function drawSelectionDecor(ctx: CanvasRenderingContext2D): void {
  if (!lastRender) return;
  const r = lastRender.imageRect;

  if (selectedStampId) {
    const b = lastRender.stampBounds.get(selectedStampId);
    if (b) {
      drawImageFrame(ctx, r);
      drawMarquee(ctx, b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h, true);
    }
    return;
  }
  if (selectedAnnotationId) {
    const a = annotations.find((an) => an.id === selectedAnnotationId);
    if (a) {
      const b = annotationBox(a, r);
      const pad = 6;
      drawMarquee(ctx, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, false);
    }
  }
}

/** 이미지 틀 — 옅은 점선 */
function drawImageFrame(ctx: CanvasRenderingContext2D, r: RenderResult["imageRect"]): void {
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.restore();
}

/** 대비 점선(검정 위 흰색) + 선택 시 코너 핸들 */
function drawMarquee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  handles: boolean,
): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeRect(x, y, w, h);
  ctx.lineDashOffset = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  if (handles) {
    for (const [hx, hy] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ] as const) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(hx - 3.5, hy - 3.5, 7, 7);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 저장/복사용 풀해상도 합성 (+ 출력 너비 적용, 직전 설정 자동 기억) */
function renderExport(): RenderResult {
  if (!baseCanvas) throw new Error("이미지가 없습니다.");
  invalidateFilterCache(); // 미리보기 캐시와 해상도가 다르므로 새로 계산
  const result = renderComposite(
    { source: baseCanvas, filters, background: bg, stamps, annotations },
    `full-${baseVersion}`,
  );
  invalidateFilterCache();
  updateLastProfile();
  if (outputWidth > 0) {
    return { ...result, canvas: scaleCanvasToWidth(result.canvas, outputWidth) };
  }
  return result;
}

function updateStatus(result: RenderResult, source: HTMLCanvasElement): void {
  if (!baseCanvas) return;
  $("#status-size").textContent = `원본 ${baseCanvas.width}×${baseCanvas.height}`;
  const scale = baseCanvas.width / source.width;
  const outW = Math.round(result.canvas.width * scale);
  const outH = Math.round(result.canvas.height * scale);
  $("#status-out").textContent = `출력 ${outW}×${outH}`;
  const notes: string[] = [];
  if (activeFilterPresetId !== "none") {
    const preset =
      FILTER_PRESETS.find((p) => p.id === activeFilterPresetId)?.name ??
      AI_FILTERS.find((f) => f.id === activeFilterPresetId)?.name ??
      (activeFilterPresetId === "custom" ? "사용자 조정" : activeFilterPresetId);
    notes.push(`필터: ${preset}`);
  }
  if (bg.preset !== "none") notes.push(`배경: ${BACKGROUND_PRESETS.find((b) => b.id === bg.preset)?.name}`);
  if (bg.ratio !== "auto") notes.push(`비율 ${bg.ratio}`);
  if (outputWidth > 0) notes.push(`출력 ↔${outputWidth}px`);
  if (annotations.length) notes.push(`주석 ${annotations.length}개`);
  if (stamps.length) notes.push(`스탬프 ${stamps.length}개`);
  $("#status-note").textContent = notes.join(" · ");
}

function setBaseCanvas(canvas: HTMLCanvasElement, opts: { pushHistory?: boolean } = {}): void {
  if (opts.pushHistory && baseCanvas) pushHistory();
  baseCanvas = canvas;
  baseVersion++;
  previewSource = downscaleCanvas(canvas, PREVIEW_MAX_DIM);
  previewSourceFast = downscaleCanvas(canvas, PREVIEW_FAST_DIM);
  invalidateFilterCache();
  // 주석 좌표는 이미지 콘텐츠 기준이라 이미지가 바뀌면(캡처·트림·자르기) 맞지 않는다
  annotations = [];
  selectedAnnotationId = null;
  syncAnnotationUI();
  emptyState.hidden = true;
  canvasWrap.hidden = false;
  statusbar.hidden = false;
  // 카메라 뷰: 힌트 → 찍은 사진 + 액션 바
  vfHint.hidden = true;
  cameraPreviewEl.hidden = false;
  captureActions.hidden = false;
  syncArmedNote();
  requestRender();
}

function pushHistory(): void {
  if (!baseCanvas) return;
  const snap = document.createElement("canvas");
  snap.width = baseCanvas.width;
  snap.height = baseCanvas.height;
  snap.getContext("2d")!.drawImage(baseCanvas, 0, 0);
  history.push(snap);
  if (history.length > MAX_HISTORY) history.shift();
}

function undo(): void {
  const prev = history.pop();
  if (!prev) {
    toast("되돌릴 작업이 없습니다.");
    return;
  }
  setBaseCanvas(prev);
  toast("되돌렸습니다.", "success");
}

function requireImage(): boolean {
  if (!baseCanvas) {
    toast("먼저 화면을 캡처하거나 이미지를 불러오세요.", "error");
    return false;
  }
  return true;
}

/* =========================================================
 * 이미지 불러오기
 * ========================================================= */

async function loadFromBlob(blob: Blob): Promise<void> {
  const canvas = await canvasFromBlob(blob);
  setBaseCanvas(canvas, { pushHistory: true });
  toast(`이미지를 불러왔습니다 (${canvas.width}×${canvas.height})`, "success");
  applyShotExtras();
}

/**
 * 셔터 우선순위: 데스크톱 래퍼(창 자동 숨김 + 선택창 없음) →
 * 연속 캡처 세션(선택창 없음) → 일반 화면 캡처(선택창 1회).
 * fromWindow 는 위젯에서 눌렀을 때 그 창(클립보드 포커스 컨텍스트).
 */
async function doCaptureScreen(fromWindow?: Window): Promise<void> {
  const editorWasOpen = isEditorOpen();
  try {
    const native = getNative();
    const canvas = native
      ? await canvasFromDataUrl(await native.captureNow())
      : session.active
        ? session.grab()
        : await captureScreen();
    setBaseCanvas(canvas, { pushHistory: true });
    if (!editorWasOpen) fireShutterFlash();
    toast(`화면을 캡처했습니다 (${canvas.width}×${canvas.height})`, "success");
    await finishShot(fromWindow);
  } catch (err) {
    toast(err instanceof Error ? err.message : "화면 캡처 실패", "error");
  }
}

/**
 * 영역 캡처 — 전체 스크린샷을 뜬 뒤 점선 오버레이에서 드래그로 영역 선택.
 * 데스크톱에서는 오버레이 동안 창을 전체화면으로 전환해
 * 스크린샷이 실제 화면과 1:1 로 겹쳐 보인다 (Win+Shift+S 느낌).
 */
async function doRegionCapture(): Promise<void> {
  const native = getNative();
  try {
    const full = native
      ? await canvasFromDataUrl(await native.captureNow())
      : session.active
        ? session.grab()
        : await captureScreen();
    native?.setFullScreen(true);
    let rect: Awaited<ReturnType<typeof selectRegion>>;
    try {
      rect = await selectRegion(full);
    } finally {
      native?.setFullScreen(false);
    }
    if (!rect) {
      toast("영역 선택이 취소되었습니다.");
      return;
    }
    setBaseCanvas(cropCanvasRect(full, rect), { pushHistory: true });
    if (!isEditorOpen()) fireShutterFlash();
    toast(`영역을 캡처했습니다 (${rect.w}×${rect.h})`, "success");
    await finishShot();
  } catch (err) {
    toast(err instanceof Error ? err.message : "영역 캡처 실패", "error");
  }
}

/** 현재 사진에서 점선 영역 선택으로 잘라내기 */
async function doCropCurrent(): Promise<void> {
  if (!requireImage()) return;
  const rect = await selectRegion(baseCanvas!);
  if (!rect) return;
  pushHistory();
  setBaseCanvas(cropCanvasRect(baseCanvas!, rect));
  toast(`잘라냈습니다 (${rect.w}×${rect.h}) — ↩️ 로 되돌리기 가능`, "success");
}

async function doPaste(): Promise<void> {
  try {
    const canvas = await canvasFromClipboard();
    setBaseCanvas(canvas, { pushHistory: true });
    toast("클립보드 이미지를 불러왔습니다.", "success");
    applyShotExtras();
  } catch (err) {
    toast(err instanceof Error ? err.message : "붙여넣기 실패", "error");
  }
}

/* =========================================================
 * 퀵 캡처 — 캡처 후 자동 동작 + 플로팅 썸네일 (ShareX/macOS 참고)
 * ========================================================= */

/** 포커스 문제(위젯에서 촬영 등)에 대비해 여러 창의 클립보드로 시도 */
async function copyCanvasSmart(canvas: HTMLCanvasElement, fromWindow?: Window): Promise<void> {
  const native = getNative();
  if (native) {
    // 데스크톱: OS 클립보드에 직접 복사 — 창 포커스 불필요
    await native.copyImage(canvas.toDataURL("image/png"));
    return;
  }
  const blob = await canvasToBlob(canvas, "png");
  const item = new ClipboardItem({ "image/png": blob });
  const targets = fromWindow && fromWindow !== window ? [fromWindow, window] : [window];
  let lastErr: unknown = null;
  for (const w of targets) {
    try {
      await w.navigator.clipboard.write([item]);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("클립보드 복사에 실패했습니다.");
}

/**
 * 촬영 마무리 공통 플로우: 스타일/도장 자동 적용 → 완성본 1회 렌더 →
 * 🎞️ 샷 히스토리에 적재 → 퀵 동작(복사/저장/썸네일).
 */
async function finishShot(fromWindow?: Window): Promise<void> {
  applyShotExtras();
  if (settings.quick.enabled && settings.quick.autoTrim) doAutoTrim(true);
  const exported = renderExport().canvas;
  await pushShotHistory(exported);
  await runQuickActions(fromWindow, exported);
}

async function runQuickActions(fromWindow?: Window, preExported?: HTMLCanvasElement): Promise<void> {
  const q = settings.quick;
  if (!q.enabled || !baseCanvas) return;

  let exported: HTMLCanvasElement | null = preExported ?? null;
  const getExported = () => (exported ??= renderExport().canvas);
  const results: string[] = [];

  if (q.autoCopy) {
    try {
      await copyCanvasSmart(getExported(), fromWindow);
      results.push("📋 복사됨");
    } catch {
      results.push("복사 실패 (창에 포커스가 필요해요)");
    }
  }
  if (q.autoSave) {
    try {
      await downloadCanvas(getExported(), $<HTMLSelectElement>("#export-format").value as ExportFormat);
      results.push("💾 저장됨");
    } catch {
      results.push("저장 실패");
    }
  }
  if (results.length) toast(`⚡ 퀵 캡처: ${results.join(" · ")}`, "success");

  const thumbUrl = downscaleCanvas(baseCanvas, 480).toDataURL("image/jpeg", 0.8);
  widget?.setThumbnail(thumbUrl);
  if (q.thumbnailSec > 0 && !isEditorOpen()) showQuickThumb(thumbUrl);
}

/* ---------- 플로팅 썸네일 ---------- */

let thumbTimer: number | null = null;

function showQuickThumb(dataUrl: string): void {
  $<HTMLImageElement>("#quick-thumb-img").src = dataUrl;
  const box = $("#quick-thumb");
  box.classList.remove("leaving");
  box.hidden = false;
  armThumbTimer();
}

function armThumbTimer(): void {
  if (thumbTimer !== null) clearTimeout(thumbTimer);
  thumbTimer = window.setTimeout(hideQuickThumb, Math.max(2, settings.quick.thumbnailSec) * 1000);
}

function hideQuickThumb(): void {
  if (thumbTimer !== null) {
    clearTimeout(thumbTimer);
    thumbTimer = null;
  }
  const box = $("#quick-thumb");
  if (box.hidden) return;
  box.classList.add("leaving");
  setTimeout(() => {
    box.hidden = true;
    box.classList.remove("leaving");
  }, 240);
}

function setupQuickThumb(): void {
  const box = $("#quick-thumb");
  box.addEventListener("mouseenter", () => {
    if (thumbTimer !== null) clearTimeout(thumbTimer);
  });
  box.addEventListener("mouseleave", armThumbTimer);
  $("#quick-thumb-img").addEventListener("click", () => {
    hideQuickThumb();
    openEditor();
  });
  $("#qt-edit").addEventListener("click", () => {
    hideQuickThumb();
    openEditor();
  });
  $("#qt-close").addEventListener("click", hideQuickThumb);
  $("#qt-copy").addEventListener("click", () => {
    void (async () => {
      try {
        await copyCanvasSmart(renderExport().canvas);
        toast("클립보드에 복사했습니다.", "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "복사 실패", "error");
      }
    })();
  });
  $("#qt-save").addEventListener("click", () => void doExport());
}

/* =========================================================
 * 🎞️ 샷 히스토리 (필름 스트립) — 찍은 완성본이 차곡차곡 쌓인다
 * ========================================================= */

interface ShotItem {
  id: number;
  w: number;
  h: number;
  thumbUrl: string;
  blob: Blob;
}

const shotHistory: ShotItem[] = [];
const MAX_SHOTS = 12;
let shotSeq = 0;

async function pushShotHistory(exported: HTMLCanvasElement): Promise<void> {
  try {
    const blob = await canvasToBlob(exported, "png");
    const thumbUrl = downscaleCanvas(exported, 240).toDataURL("image/jpeg", 0.75);
    shotHistory.push({ id: ++shotSeq, w: exported.width, h: exported.height, thumbUrl, blob });
    if (shotHistory.length > MAX_SHOTS) shotHistory.shift();
    renderShotStrip();
  } catch {
    // 히스토리 적재 실패가 촬영 흐름을 막지 않게 한다
  }
}

function renderShotStrip(): void {
  const strip = $("#shot-strip");
  const box = $("#shot-items");
  strip.hidden = shotHistory.length === 0;
  $("#shot-strip-label").textContent = `샷 ${shotHistory.length}`;
  box.innerHTML = "";
  for (const shot of [...shotHistory].reverse()) {
    const card = document.createElement("button");
    card.className = "shot-thumb";
    card.title = `#${shot.id} · ${shot.w}×${shot.h}px — 클릭하면 이 샷을 불러옵니다`;
    const img = document.createElement("img");
    img.src = shot.thumbUrl;
    img.alt = `샷 #${shot.id}`;
    const num = document.createElement("span");
    num.className = "st-num";
    num.textContent = `#${shot.id}`;
    const actions = document.createElement("div");
    actions.className = "st-actions";
    const mk = (name: Parameters<typeof icon>[0], title: string, fn: () => void) => {
      const b = document.createElement("button");
      b.innerHTML = icon(name, 11);
      b.title = title;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      });
      actions.appendChild(b);
    };
    mk("copy", "복사", () => void copyShot(shot));
    mk("download", "저장", () => saveShot(shot));
    mk("x", "기록에서 삭제", () => deleteShot(shot.id));
    card.append(img, num, actions);
    card.addEventListener("click", () => void loadShot(shot));
    box.appendChild(card);
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("이미지 변환에 실패했습니다."));
    reader.readAsDataURL(blob);
  });
}

/** 완성본(플랫)을 다시 불러온다 — 이미 스타일이 구워져 있으므로 편집은 초기화 */
async function loadShot(shot: ShotItem): Promise<void> {
  try {
    const canvas = await canvasFromBlob(shot.blob);
    clearCanvasEdits();
    setBaseCanvas(canvas, { pushHistory: true });
    toast(`#${shot.id} 샷을 불러왔습니다 — 완성본이라 편집은 초기 상태예요.`);
  } catch (err) {
    toast(err instanceof Error ? err.message : "샷을 불러오지 못했습니다.", "error");
  }
}

async function copyShot(shot: ShotItem): Promise<void> {
  try {
    const native = getNative();
    if (native) {
      await native.copyImage(await blobToDataUrl(shot.blob));
    } else {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": shot.blob })]);
    }
    toast(`#${shot.id} 샷을 클립보드에 복사했습니다.`, "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "복사에 실패했습니다.", "error");
  }
}

function saveShot(shot: ShotItem): void {
  downloadBlob(shot.blob, exportFileName("png"));
  toast(`#${shot.id} 샷을 저장했습니다.`, "success");
}

function deleteShot(id: number): void {
  const idx = shotHistory.findIndex((s) => s.id === id);
  if (idx >= 0) shotHistory.splice(idx, 1);
  renderShotStrip();
}

function clearShots(): void {
  shotHistory.length = 0;
  renderShotStrip();
  toast("샷 기록을 비웠습니다.");
}

async function saveAllShots(): Promise<void> {
  if (!shotHistory.length) return;
  for (const shot of shotHistory) {
    downloadBlob(shot.blob, exportFileName("png"));
    await new Promise((r) => setTimeout(r, 350)); // 브라우저 다운로드 차단 방지 간격
  }
  toast(`샷 ${shotHistory.length}개를 모두 저장했습니다.`, "success");
}

/* =========================================================
 * 연속 캡처 세션 + PiP 위젯
 * ========================================================= */

function displayMediaFrom(w: Window): () => Promise<MediaStream> {
  return () => w.navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
}

function syncSessionUI(): void {
  const active = session.active;
  $("#live-badge").hidden = !active;
  const btn = $("#cam-live");
  btn.classList.toggle("live", active);
  setLabel(btn, active ? "연결 해제" : "연속 캡처");
  widget?.setSessionActive(active);
  syncDeckSummary();
}

/** 연속 캡처 연결/해제. fromWindow 가 있으면 그 창(위젯)의 제스처로 권한 요청 */
async function toggleSession(fromWindow?: Window): Promise<void> {
  if (session.active) {
    session.stop();
    toast("연속 캡처를 해제했습니다.");
    return;
  }
  try {
    await session.connect(fromWindow ? displayMediaFrom(fromWindow) : undefined);
    toast("화면이 연결되었습니다 — 이제 셔터를 누르면 선택창 없이 즉시 캡처됩니다.", "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "화면 연결 실패", "error");
  }
}

async function toggleWidget(): Promise<void> {
  if (widget) {
    widget.close();
    return; // pagehide 콜백이 widget 을 정리
  }
  if (!isWidgetSupported()) {
    toast("이 브라우저는 PiP 위젯을 지원하지 않습니다. (Chrome 116 이상)", "error");
    return;
  }
  try {
    widget = await openWidget({
      onShutter: (w) => void widgetShutter(w),
      onToggleSession: (w) => void toggleSession(w),
      onOpenEditor: () => {
        window.focus();
        openEditor();
      },
      onClosed: () => {
        widget = null;
      },
    });
    widget.setSessionActive(session.active);
    toast("캡처 위젯이 열렸습니다 — 모든 창 위에 떠 있어요.", "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "위젯을 열지 못했습니다.", "error");
  }
}

/** 위젯 셔터: 연결이 없으면 위젯 제스처로 연결부터, 이후엔 즉시 촬영 */
async function widgetShutter(w: Window): Promise<void> {
  try {
    if (!session.active) {
      widget?.setStatus("화면 선택 중…");
      await session.connect(displayMediaFrom(w));
    }
    await doCaptureScreen(w);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "캡처 실패";
    widget?.setStatus(msg);
    toast(msg, "error");
  }
}

/* =========================================================
 * 필터 패널
 * ========================================================= */

interface SliderDef {
  key: keyof FilterParams;
  label: string;
  min: number;
  max: number;
}

const FILTER_SLIDERS: SliderDef[] = [
  { key: "brightness", label: "밝기", min: -100, max: 100 },
  { key: "contrast", label: "대비", min: -100, max: 100 },
  { key: "saturation", label: "채도", min: -100, max: 100 },
  { key: "temperature", label: "색온도", min: -100, max: 100 },
  { key: "tint", label: "틴트", min: -100, max: 100 },
  { key: "sharpen", label: "선명도", min: 0, max: 100 },
  { key: "blur", label: "블러", min: 0, max: 100 },
  { key: "vignette", label: "비네트", min: 0, max: 100 },
  { key: "grain", label: "그레인", min: 0, max: 100 },
  { key: "sepia", label: "세피아", min: 0, max: 100 },
];

const filterSliderRefresh: (() => void)[] = [];

/**
 * 연속 조작(슬라이더 드래그) 동안은 저해상도로 그려 즉시 반응하게 하고,
 * 손을 떼면(change) 원래 해상도로 한 번 더 그린다.
 */
let fastPreviewTimer: ReturnType<typeof setTimeout> | null = null;

function beginFastPreview(): void {
  fastPreview = true;
  if (fastPreviewTimer) clearTimeout(fastPreviewTimer);
  // change 가 오지 않는 입력 경로를 위한 안전장치
  fastPreviewTimer = setTimeout(endFastPreview, 220);
}

function endFastPreview(): void {
  if (fastPreviewTimer) {
    clearTimeout(fastPreviewTimer);
    fastPreviewTimer = null;
  }
  if (!fastPreview) return;
  fastPreview = false;
  requestRender();
}

function makeSliderRow(
  label: string,
  min: number,
  max: number,
  get: () => number,
  set: (v: number) => void,
): { el: HTMLElement; refresh: () => void } {
  const row = document.createElement("div");
  row.className = "slider-row";
  const lab = document.createElement("label");
  lab.textContent = label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.value = String(get());
  const out = document.createElement("output");
  out.textContent = String(get());
  input.addEventListener("input", () => {
    set(Number(input.value));
    out.textContent = input.value;
    beginFastPreview();
  });
  input.addEventListener("change", endFastPreview);
  row.append(lab, input, out);
  return {
    el: row,
    refresh: () => {
      input.value = String(get());
      out.textContent = String(Math.round(get()));
    },
  };
}

function buildFilterPanel(): void {
  const grid = $("#filter-presets");
  for (const preset of FILTER_PRESETS) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = preset.name;
    btn.dataset.preset = preset.id;
    if (preset.id === activeFilterPresetId) btn.classList.add("active");
    btn.addEventListener("click", () => applyFilterPreset(preset.id));
    grid.appendChild(btn);
  }

  const sliders = $("#filter-sliders");
  for (const def of FILTER_SLIDERS) {
    const { el, refresh } = makeSliderRow(
      def.label,
      def.min,
      def.max,
      () => filters[def.key] as number,
      (v) => {
        (filters[def.key] as number) = v;
        setActiveFilterPreset("custom");
        requestRender();
      },
    );
    sliders.appendChild(el);
    filterSliderRefresh.push(refresh);
  }

  const checks = document.createElement("div");
  checks.className = "check-row";
  for (const [key, label] of [["grayscale", "흑백"], ["invert", "반전"]] as const) {
    const wrap = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = filters[key];
    cb.addEventListener("change", () => {
      filters[key] = cb.checked;
      setActiveFilterPreset("custom");
      requestRender();
    });
    wrap.append(cb, label);
    checks.appendChild(wrap);
    filterSliderRefresh.push(() => (cb.checked = filters[key]));
  }
  sliders.appendChild(checks);

  $("#btn-filter-reset").addEventListener("click", () => {
    filters = defaultFilterParams();
    setActiveFilterPreset("none");
    refreshFilterUI();
    requestRender();
  });
}

function refreshFilterUI(): void {
  filterSliderRefresh.forEach((fn) => fn());
}

function setActiveFilterPreset(id: string): void {
  activeFilterPresetId = id;
  document.querySelectorAll<HTMLButtonElement>("#filter-presets .btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.preset === id);
  });
}

function applyFilterPreset(id: string): void {
  const preset = FILTER_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  filters = presetToParams(preset);
  setActiveFilterPreset(id);
  refreshFilterUI();
  requestRender();
}

/* =========================================================
 * AI 패널
 * ========================================================= */

function buildAiPanel(): void {
  const list = $("#ai-filters");
  for (const def of AI_FILTERS) {
    const btn = document.createElement("button");
    btn.className = "btn ai-filter";
    btn.dataset.ai = def.id;
    btn.innerHTML = `<span class="name">${def.name}</span><span class="sub">${def.description}</span>`;
    btn.addEventListener("click", () => runAiFilter(def.id, def.instruction, def.name));
    list.appendChild(btn);
  }

  $("#btn-ai-custom").addEventListener("click", () => {
    const prompt = $<HTMLInputElement>("#ai-custom-prompt").value.trim();
    if (!prompt) {
      toast("보정 지시를 입력해주세요.", "error");
      return;
    }
    void runAiFilter("custom", `다음 요청에 맞게 보정해줘: ${prompt}`, "직접 지시");
  });

  $("#goto-settings").addEventListener("click", (e) => {
    e.preventDefault();
    openSettings("connect");
    $<HTMLInputElement>("#api-key").focus();
  });

  $("#btn-ai-transform").addEventListener("click", () => void runEndpointTransform());
  refreshAiKeyWarning();
}

function refreshAiKeyWarning(): void {
  $("#ai-key-warning").hidden = settings.apiKey.trim().length > 0;
}

async function runAiFilter(id: string, instruction: string, label: string): Promise<void> {
  if (!requireImage()) return;
  if (!settings.apiKey.trim()) {
    toast("설정 › 연결에서 Anthropic API 키를 먼저 입력해주세요.", "error");
    openSettings("connect");
    return;
  }
  try {
    const { adjustments, toParams } = await withBusy(
      `${label} — 이미지를 분석하고 있어요…`,
      async () => {
        const ai = await import("./ai"); // 무거운 SDK 는 여기서 처음 로드
        const { base64, mediaType } = canvasToAnalysisBase64(baseCanvas!);
        return {
          adjustments: await ai.analyzeImage({
            apiKey: settings.apiKey.trim(),
            imageBase64: base64,
            mediaType,
            instruction,
          }),
          toParams: ai.adjustmentsToFilterParams,
        };
      },
    );
    filters = toParams(adjustments);
    setActiveFilterPreset(id === "custom" ? "custom" : id);
    refreshFilterUI();
    requestRender();
    const commentEl = $("#ai-comment");
    commentEl.hidden = false;
    commentEl.textContent = `💬 ${adjustments.comment}`;
    toast(`${label} 적용 완료`, "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "AI 보정에 실패했습니다.", "error");
  }
}

async function runEndpointTransform(): Promise<void> {
  if (!requireImage()) return;
  const endpoint = settings.transformEndpoint.trim();
  if (!endpoint) {
    toast("설정 › 연결에서 외부 변환 API URL 을 먼저 입력해주세요.", "error");
    openSettings("connect");
    return;
  }
  const instruction = $<HTMLInputElement>("#ai-endpoint-instruction").value.trim();
  try {
    const resultDataUrl = await withBusy("외부 API 로 이미지를 변환하고 있어요…", async () => {
      const { transformViaEndpoint } = await import("./ai");
      return transformViaEndpoint(endpoint, baseCanvas!.toDataURL("image/png"), instruction);
    });
    const canvas = await canvasFromDataUrl(resultDataUrl);
    setBaseCanvas(canvas, { pushHistory: true });
    toast("변환된 이미지를 적용했습니다. (↩️ 로 되돌리기 가능)", "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "이미지 변환에 실패했습니다.", "error");
  }
}

/* =========================================================
 * 스탬프 패널
 * ========================================================= */

function buildStampPanel(): void {
  const grid = $("#stamp-presets");
  for (const preset of STAMP_PRESETS) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = preset.name;
    btn.dataset.stampPreset = preset.id;
    btn.addEventListener("click", () => addStamp(preset.make()));
    grid.appendChild(btn);
  }

  const emojiSelect = $<HTMLSelectElement>("#stamp-emoji");
  for (const e of STAMP_EMOJIS) {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    emojiSelect.appendChild(opt);
  }
  $("#btn-stamp-emoji").addEventListener("click", () => {
    addStamp(createStamp("emoji", { text: emojiSelect.value, x: 0.15, y: 0.15, size: 0.09 }));
  });

  const styleSelect = $<HTMLSelectElement>("#stamp-style");
  for (const [id, name] of Object.entries(STAMP_STYLE_NAMES)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    styleSelect.appendChild(opt);
  }

  const formatSelect = $<HTMLSelectElement>("#stamp-format");
  for (const f of DATE_FORMATS) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${f.id} → ${f.label}`;
    formatSelect.appendChild(opt);
  }

  // 편집 필드 바인딩
  $<HTMLInputElement>("#stamp-text").addEventListener("input", (e) => {
    updateSelectedStamp((s) => (s.text = (e.target as HTMLInputElement).value));
  });
  formatSelect.addEventListener("change", () => {
    updateSelectedStamp((s) => (s.text = formatSelect.value));
  });
  styleSelect.addEventListener("change", () => {
    updateSelectedStamp((s) => (s.style = styleSelect.value as Stamp["style"]));
  });
  $<HTMLInputElement>("#stamp-color").addEventListener("input", (e) => {
    updateSelectedStamp((s) => (s.color = (e.target as HTMLInputElement).value));
  });

  const sliders = $("#stamp-sliders");
  const defs: { label: string; min: number; max: number; get: (s: Stamp) => number; set: (s: Stamp, v: number) => void }[] = [
    { label: "크기", min: 1, max: 40, get: (s) => s.size * 100, set: (s, v) => (s.size = v / 100) },
    { label: "회전", min: -180, max: 180, get: (s) => s.rotation, set: (s, v) => (s.rotation = v) },
    { label: "불투명", min: 5, max: 100, get: (s) => s.opacity * 100, set: (s, v) => (s.opacity = v / 100) },
  ];
  for (const def of defs) {
    const { el, refresh } = makeSliderRow(
      def.label,
      def.min,
      def.max,
      () => {
        const s = selectedStamp();
        return s ? Math.round(def.get(s)) : def.min;
      },
      (v) => updateSelectedStamp((s) => def.set(s, v)),
    );
    sliders.appendChild(el);
    stampEditorRefresh.push(refresh);
  }

  $("#btn-stamp-delete").addEventListener("click", () => {
    if (selectedStampId) removeStamp(selectedStampId);
  });
}

const stampEditorRefresh: (() => void)[] = [];

function selectedStamp(): Stamp | null {
  return stamps.find((s) => s.id === selectedStampId) ?? null;
}

function updateSelectedStamp(mut: (s: Stamp) => void): void {
  const s = selectedStamp();
  if (!s) return;
  mut(s);
  renderStampList();
  requestRender();
}

function addStamp(stamp: Stamp, opts: { silent?: boolean } = {}): void {
  if (!requireImage()) return;
  stamps.push(stamp);
  selectedStampId = stamp.id;
  renderStampList();
  refreshStampEditor();
  requestRender();
  if (!opts.silent) toast("스탬프를 추가했습니다. 드래그로 위치를 옮겨보세요.", "success");
}

function removeStamp(id: string): void {
  stamps = stamps.filter((s) => s.id !== id);
  if (selectedStampId === id) selectedStampId = stamps.at(-1)?.id ?? null;
  renderStampList();
  refreshStampEditor();
  requestRender();
}

function selectStamp(id: string | null): void {
  selectedStampId = id;
  renderStampList();
  refreshStampEditor();
  requestRender(); // 점선 선택 표시 갱신
}

function renderStampList(): void {
  const list = $("#stamp-list");
  list.innerHTML = "";
  if (!stamps.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "아직 스탬프가 없습니다";
    list.appendChild(li);
    return;
  }
  const kindNames = { datetime: "날짜", text: "텍스트", emoji: "이모지" } as const;
  for (const s of stamps) {
    const li = document.createElement("li");
    if (s.id === selectedStampId) li.classList.add("selected");
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = kindNames[s.kind];
    const txt = document.createElement("span");
    txt.className = "txt";
    txt.textContent = stampDisplayText(s);
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.title = "삭제";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeStamp(s.id);
    });
    li.append(kind, txt, del);
    li.addEventListener("click", () => selectStamp(s.id));
    list.appendChild(li);
  }
}

function refreshStampEditor(): void {
  const editor = $("#stamp-editor");
  const s = selectedStamp();
  editor.hidden = !s;
  if (!s) return;
  const isDate = s.kind === "datetime";
  $("#stamp-text-field").hidden = isDate;
  $("#stamp-format-field").hidden = !isDate;
  if (isDate) {
    $<HTMLSelectElement>("#stamp-format").value = s.text;
  } else {
    $<HTMLInputElement>("#stamp-text").value = s.text;
  }
  $<HTMLSelectElement>("#stamp-style").value = s.style;
  const colorInput = $<HTMLInputElement>("#stamp-color");
  if (/^#[0-9a-f]{6}$/i.test(s.color)) colorInput.value = s.color;
  stampEditorRefresh.forEach((fn) => fn());
}

/* ---------- 스탬프 드래그 ---------- */

/* =========================================================
 * 캔버스 인터랙션 — 주석 그리기 / 스탬프 드래그 / 선택
 *
 * 드래그 중에는 합성(renderComposite)을 절대 다시 돌리지 않는다.
 * 움직이는 요소는 오버레이 캔버스에만 그리고, 손을 뗄 때 한 번만 합성한다.
 * ========================================================= */

function setupCanvasInteraction(): void {
  let stampOffset = { x: 0, y: 0 };

  const toCanvas = (e: PointerEvent): { x: number; y: number } => {
    const rect = previewEl.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * previewEl.width,
      y: ((e.clientY - rect.top) / rect.height) * previewEl.height,
    };
  };

  const hitStamp = (x: number, y: number): string | null => {
    if (!lastRender) return null;
    for (let i = stamps.length - 1; i >= 0; i--) {
      const b = lastRender.stampBounds.get(stamps[i].id);
      if (!b) continue;
      if (Math.abs(x - b.cx) <= b.w / 2 && Math.abs(y - b.cy) <= b.h / 2) return stamps[i].id;
    }
    return null;
  };

  const hitAnnotation = (x: number, y: number): string | null => {
    if (!lastRender) return null;
    for (let i = annotations.length - 1; i >= 0; i--) {
      if (hitTestAnnotation(annotations[i], x, y, lastRender.imageRect)) return annotations[i].id;
    }
    return null;
  };

  previewEl.addEventListener("pointerdown", (e) => {
    if (!lastRender) return;
    const { x, y } = toCanvas(e);
    const r = lastRender.imageRect;
    previewEl.setPointerCapture(e.pointerId);

    if (activeTool) {
      const nx = clamp((x - r.x) / r.w, 0, 1);
      const ny = clamp((y - r.y) / r.h, 0, 1);
      draftAnnotation = createAnnotation(activeTool, nx, ny, nx, ny, {
        color: annoColor,
        size: annoSize,
      });
      drawOverlay();
      return;
    }

    const stampId = hitStamp(x, y);
    if (stampId) {
      const b = lastRender.stampBounds.get(stampId)!;
      stampOffset = { x: x - b.cx, y: y - b.cy };
      selectAnnotation(null);
      selectStamp(stampId);
      beginStampDrag(stampId);
      return;
    }
    selectStamp(null);
    selectAnnotation(hitAnnotation(x, y));
  });

  previewEl.addEventListener("pointermove", (e) => {
    if (!lastRender) return;
    const { x, y } = toCanvas(e);
    const r = lastRender.imageRect;

    if (draftAnnotation) {
      draftAnnotation.x2 = clamp((x - r.x) / r.w, 0, 1);
      draftAnnotation.y2 = clamp((y - r.y) / r.h, 0, 1);
      drawOverlay();
      return;
    }
    if (draggingStampId) {
      const s = stamps.find((st) => st.id === draggingStampId);
      if (s) {
        s.x = clamp((x - stampOffset.x - r.x) / r.w, -0.08, 1.08);
        s.y = clamp((y - stampOffset.y - r.y) / r.h, -0.08, 1.08);
        drawOverlay();
      }
      return;
    }
    previewEl.classList.toggle(
      "stamp-hover",
      !activeTool && (hitStamp(x, y) !== null || hitAnnotation(x, y) !== null),
    );
  });

  const endDrag = (e: PointerEvent) => {
    if (previewEl.hasPointerCapture(e.pointerId)) previewEl.releasePointerCapture(e.pointerId);

    if (draftAnnotation) {
      const a = draftAnnotation;
      draftAnnotation = null;
      if (!isDegenerate(a)) {
        annotations.push(a);
        syncAnnotationUI();
      }
      requestRender(); // 확정 시 1회만 합성
      return;
    }
    if (draggingStampId) {
      draggingStampId = null;
      previewEl.classList.remove("stamp-drag");
      renderStampList();
      requestRender();
    }
  };
  previewEl.addEventListener("pointerup", endDrag);
  previewEl.addEventListener("pointercancel", endDrag);
}

/** 드래그 대상 스탬프를 뺀 합성 결과를 고정 배경으로 깔아둔다 (이후 프레임은 오버레이만) */
function beginStampDrag(id: string): void {
  const source = (fastPreview && previewSourceFast) || previewSource;
  if (!source) return;
  draggingStampId = id;
  previewEl.classList.add("stamp-drag");
  const base = renderComposite(
    {
      source,
      filters,
      background: bg,
      stamps: stamps.filter((s) => s.id !== id),
      annotations,
    },
    `${source === previewSource ? "prev" : "fast"}-${baseVersion}`,
  );
  const ctx = previewEl.getContext("2d")!;
  ctx.clearRect(0, 0, previewEl.width, previewEl.height);
  ctx.drawImage(base.canvas, 0, 0);
  drawOverlay();
}

/* =========================================================
 * 주석 패널
 * ========================================================= */

const ANNO_COLORS = ["#ff3b5c", "#ffb020", "#22c55e", "#3b82f6", "#111827", "#ffffff"];

function buildAnnotationPanel(): void {
  const row = $("#annotation-tools");

  const addTool = (id: AnnotationKind | null, name: string, iconName: Parameters<typeof icon>[0]) => {
    const btn = document.createElement("button");
    btn.className = "tool";
    btn.dataset.tool = id ?? "";
    btn.title = name;
    btn.innerHTML = icon(iconName, 17);
    btn.addEventListener("click", () => setTool(activeTool === id ? null : id));
    row.appendChild(btn);
  };
  addTool(null, "선택 · 이동", "cursor");
  for (const t of ANNOTATION_TOOLS) addTool(t.id, t.name, t.icon);

  const swatches = $("#anno-swatches");
  for (const c of ANNO_COLORS) {
    const b = document.createElement("button");
    b.className = "swatch";
    b.dataset.color = c;
    b.style.background = c;
    b.title = c;
    b.addEventListener("click", () => setAnnoColor(c));
    swatches.appendChild(b);
  }
  const colorInput = $<HTMLInputElement>("#anno-color");
  colorInput.value = annoColor;
  colorInput.addEventListener("input", () => setAnnoColor(colorInput.value));

  const { el } = makeSliderRow("크기", 5, 100, () => annoSize, (v) => {
    annoSize = v;
    applyToSelectedAnnotation((a) => (a.size = v));
  });
  $("#anno-sliders").appendChild(el);

  $("#btn-anno-clear").addEventListener("click", clearAnnotations);
  syncAnnotationUI();
}

function setAnnoColor(color: string): void {
  annoColor = color;
  $<HTMLInputElement>("#anno-color").value = color;
  applyToSelectedAnnotation((a) => (a.color = color));
  syncAnnotationUI();
}

function applyToSelectedAnnotation(fn: (a: Annotation) => void): void {
  const a = annotations.find((an) => an.id === selectedAnnotationId);
  if (!a) return;
  fn(a);
  requestRender();
}

function setTool(kind: AnnotationKind | null): void {
  activeTool = kind;
  if (kind) {
    selectStamp(null);
    selectAnnotation(null);
  }
  previewEl.classList.toggle("drawing", !!kind);
  syncAnnotationUI();
}

function selectAnnotation(id: string | null): void {
  selectedAnnotationId = id;
  if (id) {
    const a = annotations.find((an) => an.id === id);
    if (a) {
      annoColor = a.color;
      annoSize = a.size;
      $<HTMLInputElement>("#anno-color").value = a.color;
    }
  }
  syncAnnotationUI();
  drawOverlay();
}

function removeAnnotation(id: string): void {
  annotations = annotations.filter((a) => a.id !== id);
  if (selectedAnnotationId === id) selectedAnnotationId = null;
  syncAnnotationUI();
  requestRender();
}

function clearAnnotations(): void {
  if (annotations.length === 0) return;
  annotations = [];
  selectedAnnotationId = null;
  syncAnnotationUI();
  requestRender();
  toast("주석을 모두 지웠습니다.");
}

function syncAnnotationUI(): void {
  document.querySelectorAll<HTMLElement>("#annotation-tools .tool").forEach((b) => {
    b.classList.toggle("active", (b.dataset.tool ?? "") === (activeTool ?? ""));
  });
  document.querySelectorAll<HTMLElement>("#anno-swatches .swatch").forEach((b) => {
    b.classList.toggle("active", b.dataset.color === annoColor);
  });

  const editing = !!activeTool || !!selectedAnnotationId;
  // 모자이크는 색이 의미 없으므로 색 선택을 숨긴다
  $("#anno-style").hidden = !editing || activeTool === "mosaic";
  $("#anno-sliders").hidden = !editing;
  $("#btn-anno-clear").hidden = annotations.length === 0;

  const hint = $("#anno-hint");
  if (activeTool) {
    const name = ANNOTATION_TOOLS.find((t) => t.id === activeTool)?.name ?? "";
    hint.textContent = `${name} — 미리보기에서 드래그하세요.`;
  } else if (selectedAnnotationId) {
    hint.textContent = "선택됨 — Del 로 삭제, 색·크기를 바꿀 수 있습니다.";
  } else if (annotations.length) {
    hint.textContent = "주석을 클릭하면 선택됩니다.";
  } else {
    hint.textContent = "도구를 고른 뒤 미리보기에서 드래그하세요.";
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* =========================================================
 * 배경 패널
 * ========================================================= */

const bgSliderRefresh: (() => void)[] = [];

function buildBackgroundPanel(): void {
  const smart = $("#smart-backgrounds");
  for (const f of SMART_BACKGROUND_FILTERS) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.dataset.smart = f.id;
    btn.innerHTML = `<span class="name">${f.name}</span><span class="sub">${f.description}</span>`;
    btn.addEventListener("click", () => applySmartBackground(f.id));
    smart.appendChild(btn);
  }

  const grid = $("#bg-presets");
  for (const preset of BACKGROUND_PRESETS) {
    const sw = document.createElement("button");
    sw.className = "bg-swatch";
    sw.dataset.bg = preset.id;
    sw.style.background = preset.css;
    sw.textContent = preset.name;
    if (preset.id === bg.preset) sw.classList.add("active");
    sw.addEventListener("click", () => {
      bg.preset = preset.id;
      syncBackgroundUI();
      requestRender();
    });
    grid.appendChild(sw);
  }

  $<HTMLInputElement>("#bg-solid-color").value = bg.solidColor;
  $<HTMLInputElement>("#bg-solid-color").addEventListener("input", (e) => {
    bg.solidColor = (e.target as HTMLInputElement).value;
    requestRender();
  });

  const ratioRow = $("#ratio-buttons");
  for (const r of RATIO_CHOICES) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.dataset.ratio = r;
    btn.textContent = r === "auto" ? "자동" : r;
    if (r === bg.ratio) btn.classList.add("active");
    btn.addEventListener("click", () => setRatio(r));
    ratioRow.appendChild(btn);
  }

  const sliders = $("#bg-sliders");
  const defs: { label: string; min: number; max: number; get: () => number; set: (v: number) => void }[] = [
    { label: "여백", min: 0, max: 30, get: () => bg.padding * 100, set: (v) => (bg.padding = v / 100) },
    { label: "모서리", min: 0, max: 12, get: () => bg.radius * 100, set: (v) => (bg.radius = v / 100) },
    { label: "그림자", min: 0, max: 100, get: () => bg.shadow, set: (v) => (bg.shadow = v) },
  ];
  for (const def of defs) {
    const { el, refresh } = makeSliderRow(def.label, def.min, def.max,
      () => Math.round(def.get()),
      (v) => {
        def.set(v);
        requestRender();
      },
    );
    sliders.appendChild(el);
    bgSliderRefresh.push(refresh);
  }

  const outWidthSelect = $<HTMLSelectElement>("#out-width");
  outWidthSelect.addEventListener("change", () => {
    outputWidth = Number(outWidthSelect.value) || 0;
    requestRender();
  });

  $("#btn-auto-trim").addEventListener("click", () => doAutoTrim(false));
}

function syncBackgroundUI(): void {
  document.querySelectorAll<HTMLElement>("#bg-presets .bg-swatch").forEach((el) => {
    el.classList.toggle("active", el.dataset.bg === bg.preset);
  });
  document.querySelectorAll<HTMLButtonElement>("#ratio-buttons .btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.ratio === bg.ratio);
  });
  $("#bg-solid-field").hidden = bg.preset !== "solid";
  const outSelect = $<HTMLSelectElement>("#out-width");
  outSelect.value = [0, 1920, 1600, 1280, 1024, 800].includes(outputWidth) ? String(outputWidth) : "0";
  bgSliderRefresh.forEach((fn) => fn());
}

function setRatio(r: string): void {
  bg.ratio = r;
  syncBackgroundUI();
  requestRender();
}

function cycleRatio(): void {
  const idx = RATIO_CHOICES.indexOf(bg.ratio as (typeof RATIO_CHOICES)[number]);
  setRatio(RATIO_CHOICES[(idx + 1) % RATIO_CHOICES.length]);
  toast(`비율: ${bg.ratio === "auto" ? "자동" : bg.ratio}`);
}

/** 창 밖 균일 여백 자동 제거 */
function doAutoTrim(silent: boolean): boolean {
  if (!requireImage()) return false;
  const insets = detectTrim(rawFromCanvas(baseCanvas!));
  if (!hasTrim(insets)) {
    if (!silent) toast("제거할 주변 여백을 찾지 못했습니다.");
    return false;
  }
  pushHistory();
  setBaseCanvas(cropCanvas(baseCanvas!, insets));
  if (!silent) {
    toast(
      `여백을 제거했습니다 (←${insets.left} ↑${insets.top} →${insets.right} ↓${insets.bottom}px)`,
      "success",
    );
  }
  return true;
}

/** 스마트 배경 필터: 트림 + 배경/비율/여백 일괄 적용 */
function applySmartBackground(id: string, opts: { silent?: boolean } = {}): void {
  const f = SMART_BACKGROUND_FILTERS.find((x) => x.id === id);
  if (!f || !requireImage()) return;
  const trimmed = f.autoTrim ? doAutoTrim(true) : false;
  bg = { ...bg, ...f.options };
  syncBackgroundUI();
  requestRender();
  if (!opts.silent) toast(`${f.name} 적용${trimmed ? " (여백 자동 제거됨)" : ""}`, "success");
}

/* =========================================================
 * 홈 덱 — 카메라 화면의 퀵·룩·도장 (촬영 전 선택 → 샷에 자동 적용)
 * ========================================================= */

/** 룩을 현재 사진에 적용 (랜덤은 호출 전에 해석해서 전달) */
function applyLookNow(look: LookDef, opts: { silent?: boolean } = {}): void {
  if (!baseCanvas) return;
  if (look.autoTrim) doAutoTrim(true);
  if (look.smartId) applySmartBackground(look.smartId, { silent: true });
  if (look.bg) {
    bg = { ...bg, ...look.bg };
    syncBackgroundUI();
  }
  if (look.filterPresetId) applyFilterPreset(look.filterPresetId);
  requestRender();
  if (!opts.silent) toast(`${look.emoji} ${look.name} 룩 적용`, "success");
}

/* ---------- 내 프리셋 (캡처 프로파일) ---------- */

function findProfile(id: string): CaptureProfile | null {
  if (id === LAST_PROFILE_ID) return settings.lastProfile;
  return settings.profiles.find((p) => p.id === id) ?? null;
}

/** 프로파일을 현재 상태에 통째로 적용 — 필터(AI 결과 포함)·배경/비율·스탬프·출력 크기 */
function applyProfile(profile: CaptureProfile, opts: { silent?: boolean } = {}): void {
  if (!baseCanvas) return;
  filters = { ...profile.filters };
  bg = { ...profile.bg };
  stamps = cloneProfileStamps(profile);
  selectedStampId = null;
  outputWidth = profile.outputWidth;
  setActiveFilterPreset("custom");
  refreshFilterUI();
  syncBackgroundUI();
  renderStampList();
  refreshStampEditor();
  requestRender();
  if (!opts.silent) toast(`${profile.emoji} ${profile.name} 프리셋 적용`, "success");
}

/** 선택 스타일(룩/프리셋) 공통 조회 — 요약 칩/안내 라벨용 */
function getStyleInfo(id: string): { emoji: string; name: string } | null {
  if (id === "look-none") return null;
  const profile = findProfile(id);
  if (profile) return { emoji: profile.emoji, name: profile.name };
  const look = getLook(id);
  return look ? { emoji: look.emoji, name: look.name } : null;
}

/** 선택 스타일을 현재 사진에 적용. 실제 적용된 스타일 정보를 반환 (없으면 null) */
function applyStyleById(id: string, opts: { silent?: boolean } = {}): { emoji: string; name: string } | null {
  if (id === "look-none" || !baseCanvas) return null;
  const profile = findProfile(id);
  if (profile) {
    applyProfile(profile, opts);
    return { emoji: profile.emoji, name: profile.name };
  }
  const look = getLook(id);
  if (!look) return null;
  const resolved = look.id === RANDOM_LOOK_ID ? pickRandomLook() : look;
  applyLookNow(resolved, opts);
  return { emoji: resolved.emoji, name: `${resolved.name} 룩` };
}

/** 내보내기/복사에 실제로 쓰인 편집 상태를 "직전 설정" 으로 자동 기억 */
function updateLastProfile(): void {
  const hasEdits =
    !isNeutralState() || stamps.length > 0;
  if (!hasEdits) return;
  settings.lastProfile = buildProfile("직전 설정", { filters, bg, stamps, outputWidth }, {
    id: LAST_PROFILE_ID,
    emoji: "🕘",
  });
  saveSettings(settings);
  renderProfileRow();
}

function isNeutralState(): boolean {
  const d = defaultBackgroundOptions();
  const bgNeutral =
    bg.preset === d.preset && bg.ratio === d.ratio && outputWidth === 0;
  return isNeutralFilters() && bgNeutral;
}

function isNeutralFilters(): boolean {
  const d = defaultFilterParams();
  return (Object.keys(d) as (keyof FilterParams)[]).every((k) => filters[k] === d[k]);
}

function saveCurrentProfile(name: string): CaptureProfile | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = settings.profiles.find((p) => p.name === trimmed);
  const profile = buildProfile(trimmed, { filters, bg, stamps, outputWidth }, {
    id: existing?.id,
    emoji: existing?.emoji,
  });
  if (existing) {
    settings.profiles = settings.profiles.map((p) => (p.id === existing.id ? profile : p));
    toast(`${profile.emoji} '${trimmed}' 프리셋을 덮어썼습니다.`, "success");
  } else {
    if (settings.profiles.length >= MAX_PROFILES) {
      toast(`프리셋은 ${MAX_PROFILES}개까지 저장할 수 있어요. 하나를 지우고 다시 시도해주세요.`, "error");
      return null;
    }
    settings.profiles = [...settings.profiles, profile];
    toast(`${profile.emoji} '${trimmed}' 프리셋 저장 — 선택해두면 매 샷이 이 세팅으로 나와요.`, "success");
  }
  saveSettings(settings);
  renderProfileRow();
  selectLook(profile.id);
  return profile;
}

function deleteProfile(id: string): void {
  settings.profiles = settings.profiles.filter((p) => p.id !== id);
  saveSettings(settings);
  if (selectedLookId === id) selectedLookId = "look-none";
  renderProfileRow();
  syncLookUI();
  syncArmedNote();
  toast("프리셋을 삭제했습니다.");
}

/** 새로 획득한 샷에 선택된 스타일(룩/프리셋) + 대기 중인 도장을 자동 적용 */
function applyShotExtras(): void {
  const applied = applyStyleById(selectedLookId, { silent: true });

  let stampCount = 0;
  for (const id of armedStampIds) {
    const preset = STAMP_PRESETS.find((p) => p.id === id);
    if (preset) {
      addStamp(preset.make(), { silent: true });
      stampCount++;
    }
  }
  armedStampIds.clear();
  syncFunRow();
  syncArmedNote();

  const bits: string[] = [];
  if (applied) bits.push(`${applied.emoji} ${applied.name}`);
  if (stampCount) bits.push(`스탬프 ${stampCount}개`);
  if (bits.length) toast(`✨ ${bits.join(" · ")} 자동 적용`, "success");
}

function selectLook(id: string): void {
  selectedLookId = id;
  syncLookUI();
  syncArmedNote();
  if (id === "look-none") return;
  if (baseCanvas) {
    applyStyleById(id);
  } else {
    const info = getStyleInfo(id);
    if (info) toast(`${info.emoji} ${info.name} 선택 — 다음 캡처에 자동 적용돼요.`);
  }
}

function syncLookUI(): void {
  document
    .querySelectorAll<HTMLButtonElement>("#look-row .look-card, #profile-row .look-card")
    .forEach((el) => {
      el.classList.toggle("active", el.dataset.look === selectedLookId);
    });
}

function syncFunRow(): void {
  document.querySelectorAll<HTMLButtonElement>("#fun-row .chip").forEach((el) => {
    el.classList.toggle("armed", armedStampIds.has(el.dataset.stampChip ?? ""));
  });
}

function syncArmedNote(): void {
  const note = $("#armed-note");
  const info = getStyleInfo(selectedLookId);
  const bits: string[] = [];
  if (!baseCanvas && info) bits.push(`${info.emoji} ${info.name}`);
  if (armedStampIds.size) bits.push(`스탬프 ${armedStampIds.size}개`);
  note.hidden = bits.length === 0;
  note.textContent = bits.length ? `다음 샷: ${bits.join(" · ")}` : "";
  syncDeckSummary();
}

function quickChipLabel(): string {
  const q = settings.quick;
  if (!q.enabled) return "캡처 후: 꺼짐";
  const bits = [
    q.autoTrim ? "트림" : null,
    q.autoCopy ? "복사" : null,
    q.autoSave ? "저장" : null,
    q.thumbnailSec > 0 ? "썸네일" : null,
  ].filter((v): v is string => v !== null);
  return `캡처 후: ${bits.length ? bits.join("·") : "켜짐"}`;
}

function refreshQuickChip(): void {
  const chip = $("#qk-chip");
  setLabel(chip, quickChipLabel());
  chip.classList.toggle("active", settings.quick.enabled);
  syncDeckSummary();
}

/** 📦 프리셋 줄: [저장 칩] [🕘 직전 설정] [내 프리셋들…] */
function renderProfileRow(): void {
  const row = $("#profile-row");
  row.innerHTML = "";

  // 현재 설정 저장 — 클릭하면 칩이 이름 입력으로 바뀜 (Enter 저장 / Esc 취소)
  const saveChip = document.createElement("button");
  saveChip.className = "chip save-profile";
  saveChip.id = "profile-save";
  applyIcon(saveChip, "floppy", "현재 설정 저장");
  saveChip.title = "지금 편집 상태(크기·비율·배경·필터·AI 보정 결과·스탬프)를 프리셋으로 저장";
  saveChip.addEventListener("click", () => {
    if (saveChip.querySelector("input")) return;
    const lbl = saveChip.querySelector<HTMLElement>(".lbl")!;
    lbl.textContent = "";
    const input = document.createElement("input");
    input.placeholder = "프리셋 이름 + Enter";
    input.maxLength = 24;
    input.value = "";
    lbl.appendChild(input);
    input.focus();
    const done = () => renderProfileRow();
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        saveCurrentProfile(input.value);
        done();
      } else if (e.key === "Escape") {
        done();
      }
    });
    input.addEventListener("blur", done);
  });
  row.appendChild(saveChip);

  const makeCard = (profile: CaptureProfile, opts: { last?: boolean } = {}) => {
    const card = document.createElement("button");
    card.className = `look-card ${opts.last ? "last" : ""}`.trim();
    card.dataset.look = profile.id;
    const emoji = document.createElement("span");
    emoji.className = "lk-emoji";
    emoji.textContent = profile.emoji;
    const name = document.createElement("span");
    name.textContent = profile.name;
    card.append(emoji, name);
    const parts = [
      profile.bg.ratio !== "auto" ? `비율 ${profile.bg.ratio}` : null,
      profile.outputWidth ? `↔${profile.outputWidth}px` : null,
      profile.stamps.length ? `스탬프 ${profile.stamps.length}` : null,
    ].filter(Boolean);
    card.title = `${opts.last ? "마지막 내보내기에 쓴 설정" : "저장된 프리셋"}${parts.length ? ` — ${parts.join(" · ")}` : ""}\n선택하면 매 샷에 자동 적용됩니다`;
    card.addEventListener("click", () => selectLook(profile.id));
    if (!opts.last) {
      const x = document.createElement("span");
      x.className = "pk-x";
      x.textContent = "✕";
      x.title = "프리셋 삭제";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteProfile(profile.id);
      });
      card.appendChild(x);
    }
    row.appendChild(card);
  };

  if (settings.lastProfile) makeCard(settings.lastProfile, { last: true });
  for (const p of settings.profiles) makeCard(p);
  syncLookUI();
}

const HOME_STAMP_CHIPS = [
  "date",
  "datetime",
  "seal-approve",
  "seal-check",
  "badge-confidential",
  "badge-draft",
  "emoji-star",
];

/* ---------- 덱 접기/펼치기 + 설정된 요소 요약 ---------- */

function applyDeckState(): void {
  $("#home-deck").hidden = !settings.deckOpen;
  $("#quick-chips").hidden = !settings.deckOpen;
  const toggle = $("#deck-toggle");
  setLabel(toggle, settings.deckOpen ? "도구 접기" : "도구");
  toggle.classList.toggle("active", settings.deckOpen);
  syncDeckSummary();
}

function toggleDeck(): void {
  settings.deckOpen = !settings.deckOpen;
  saveSettings(settings);
  applyDeckState();
}

/** 덱이 접힌 상태에서는 "설정되어 있는 요소만" 요약 칩으로 표시 */
function syncDeckSummary(): void {
  const box = $("#deck-summary");
  box.innerHTML = "";
  if (settings.deckOpen) return; // 덱이 열려 있으면 요약 불필요

  const addChip = (
    label: string,
    opts: {
      title?: string;
      cls?: string;
      iconName?: Parameters<typeof icon>[0];
      onClick?: () => void;
      onClear?: () => void;
    } = {},
  ) => {
    const chip = document.createElement("button");
    chip.className = `chip ${opts.cls ?? ""} ${opts.onClick ? "" : "summary"}`.trim();
    if (opts.iconName) applyIcon(chip, opts.iconName, label);
    else chip.textContent = label;
    if (opts.title) chip.title = opts.title;
    if (opts.onClick) chip.addEventListener("click", opts.onClick);
    if (opts.onClear) {
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "✕";
      x.title = "해제";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        opts.onClear!();
      });
      chip.appendChild(x);
    }
    box.appendChild(chip);
  };

  if (session.active) {
    addChip("🔴 LIVE", { title: "연속 캡처 중 — 클릭해서 해제", cls: "live", onClick: () => void toggleSession() });
  }
  const info = getStyleInfo(selectedLookId);
  if (info) {
    addChip(`${info.emoji} ${info.name}`, {
      title: "선택된 촬영 스타일 — 클릭해서 도구 열기, ✕ 로 해제",
      cls: "active",
      onClick: toggleDeck,
      onClear: () => selectLook("look-none"),
    });
  }
  if (armedStampIds.size) {
    addChip(`스탬프 ${armedStampIds.size}`, {
      title: "다음 샷에 추가될 스탬프 — 클릭해서 도구 열기",
      cls: "armed",
      onClick: toggleDeck,
    });
  }
  if (settings.quick.enabled) {
    addChip(quickChipLabel(), {
      title: "캡처 후 자동 동작 — 클릭해서 설정",
      iconName: "zap",
      onClick: () => openSettings("capture"),
    });
  }
}

function buildHomeDeck(): void {
  const lookRow = $("#look-row");
  for (const look of LOOKS) {
    const card = document.createElement("button");
    card.className = "look-card";
    card.dataset.look = look.id;
    const emoji = document.createElement("span");
    emoji.className = "lk-emoji";
    emoji.textContent = look.emoji;
    const name = document.createElement("span");
    name.textContent = look.name;
    card.append(emoji, name);
    card.title =
      look.id === "look-none"
        ? "룩 없이 캡처"
        : "사진이 있으면 바로 적용, 없으면 다음 캡처에 자동 적용";
    card.addEventListener("click", () => selectLook(look.id));
    lookRow.appendChild(card);
  }

  const funRow = $("#fun-row");
  for (const id of HOME_STAMP_CHIPS) {
    const preset = STAMP_PRESETS.find((p) => p.id === id);
    if (!preset) continue;
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.dataset.stampChip = id;
    chip.textContent = preset.name;
    chip.title = "사진이 있으면 바로 추가, 없으면 다음 샷에 자동 추가";
    chip.addEventListener("click", () => {
      if (baseCanvas) {
        addStamp(preset.make());
      } else {
        if (armedStampIds.has(id)) armedStampIds.delete(id);
        else armedStampIds.add(id);
        syncFunRow();
        syncArmedNote();
      }
    });
    funRow.appendChild(chip);
  }

  $("#qk-chip").addEventListener("click", () => openSettings("capture"));
  renderProfileRow();
  syncLookUI();
  syncFunRow();
  syncArmedNote();
  refreshQuickChip();
}

/* =========================================================
 * 설정 창 — 캡처 / 단축키 / 연결
 * ========================================================= */

let cancelRecording: (() => void) | null = null;
/** 단축키 검색어 (소문자) */
let shortcutQuery = "";

function buildSettingsWindow(): void {
  // 캡처 후 자동 동작
  const quickChecks: [string, keyof Omit<QuickSettings, "thumbnailSec">][] = [
    ["#qk-enabled", "enabled"],
    ["#qk-trim", "autoTrim"],
    ["#qk-copy", "autoCopy"],
    ["#qk-save", "autoSave"],
  ];
  for (const [sel, key] of quickChecks) {
    const cb = $<HTMLInputElement>(sel);
    cb.checked = settings.quick[key];
    cb.addEventListener("change", () => {
      settings.quick[key] = cb.checked;
      saveSettings(settings);
      refreshQuickChip();
    });
  }
  const qkSliders = $("#qk-sliders");
  const { el: thumbSlider } = makeSliderRow(
    "썸네일(초)",
    0,
    15,
    () => settings.quick.thumbnailSec,
    (v) => {
      settings.quick.thumbnailSec = v;
      saveSettings(settings);
      refreshQuickChip();
    },
  );
  qkSliders.appendChild(thumbSlider);

  // 단축키
  renderShortcutList();
  const search = $<HTMLInputElement>("#shortcut-search");
  search.addEventListener("input", () => {
    shortcutQuery = search.value.trim().toLowerCase();
    renderShortcutList();
  });
  $("#btn-shortcut-reset").addEventListener("click", () => {
    manager.resetAll();
    renderShortcutList();
    toast("단축키를 기본값으로 되돌렸습니다.", "success");
  });

  // 연결
  const apiKeyInput = $<HTMLInputElement>("#api-key");
  apiKeyInput.value = settings.apiKey;
  apiKeyInput.addEventListener("change", () => {
    settings.apiKey = apiKeyInput.value.trim();
    saveSettings(settings);
    refreshAiKeyWarning();
    if (settings.apiKey) toast("API 키를 저장했습니다. (이 브라우저에만 저장)", "success");
  });

  const endpointInput = $<HTMLInputElement>("#transform-endpoint");
  endpointInput.value = settings.transformEndpoint;
  endpointInput.addEventListener("change", () => {
    settings.transformEndpoint = endpointInput.value.trim();
    saveSettings(settings);
    refreshEndpointRow();
  });
  refreshEndpointRow();

  // 창 조작 — 섹션 전환 / 닫기 / 바깥 클릭
  document.querySelectorAll<HTMLButtonElement>(".sect").forEach((btn) => {
    btn.addEventListener("click", () => switchSettingsSection(btn.dataset.sect as SettingsSection));
  });
  $("#settings-close").addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("pointerdown", (e) => {
    if (e.target === settingsBackdrop) closeSettings();
  });

  manager.onChange = (map) => {
    settings.shortcuts = map;
    saveSettings(settings);
    updateShortcutHints();
  };
}

/** 외부 변환 API 는 설정된 경우에만 편집 창에 나타난다 */
function refreshEndpointRow(): void {
  $("#ai-endpoint-row").hidden = settings.transformEndpoint.trim().length === 0;
}

function renderShortcutList(): void {
  const list = $("#shortcut-list");
  list.innerHTML = "";
  let shown = 0;

  for (const group of ACTION_GROUPS) {
    const actions = ACTIONS.filter((a) => a.group === group && matchesShortcutQuery(a.label, a.id));
    if (actions.length === 0) continue;

    const section = document.createElement("div");
    section.className = "sc-group";
    const title = document.createElement("h3");
    title.textContent = group;
    const ul = document.createElement("ul");
    for (const action of actions) {
      ul.appendChild(buildShortcutRow(action.id, action.label));
      shown++;
    }
    section.append(title, ul);
    list.appendChild(section);
  }

  $("#shortcut-empty").hidden = shown > 0;
  updateShortcutHints();
}

function matchesShortcutQuery(label: string, id: ActionId): boolean {
  if (!shortcutQuery) return true;
  const combo = formatCombo(manager.getCombo(id)).toLowerCase();
  return label.toLowerCase().includes(shortcutQuery) || combo.includes(shortcutQuery);
}

function buildShortcutRow(id: ActionId, label: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "sc-row";

  const name = document.createElement("span");
  name.className = "label";
  name.textContent = label;

  const combo = manager.getCombo(id);
  const keyBtn = document.createElement("button");
  keyBtn.className = `sc-key ${combo ? "" : "empty"}`.trim();
  keyBtn.textContent = formatCombo(combo);
  keyBtn.title = "클릭 후 원하는 키를 누르세요";
  keyBtn.addEventListener("click", () => startRecordShortcut(id, keyBtn));

  const clearBtn = document.createElement("button");
  clearBtn.className = "sc-clear";
  clearBtn.innerHTML = icon("x", 12);
  clearBtn.title = "단축키 해제";
  clearBtn.addEventListener("click", () => {
    manager.clear(id);
    renderShortcutList();
  });

  li.append(name, keyBtn, clearBtn);
  return li;
}

function startRecordShortcut(id: ActionId, btn: HTMLButtonElement): void {
  cancelRecording?.();
  btn.classList.add("recording");
  btn.textContent = "키를 누르세요…";
  const cancel = manager.startRecording((combo) => {
    cancelRecording = null;
    if (!combo) {
      renderShortcutList();
      return;
    }
    const result = manager.assign(id, combo);
    if (!result.ok) {
      toast(result.reason ?? "이 조합은 사용할 수 없습니다.", "error");
    } else if (result.stolenFrom) {
      const stolenLabel = ACTIONS.find((a) => a.id === result.stolenFrom)?.label ?? result.stolenFrom;
      toast(`'${formatCombo(combo)}' 를 '${stolenLabel}' 에서 가져왔습니다.`);
    } else {
      toast(`단축키 설정: ${formatCombo(combo)}`, "success");
    }
    renderShortcutList();
  });
  cancelRecording = () => {
    cancel();
    renderShortcutList();
  };
}

function updateShortcutHints(): void {
  const hint = document.querySelector<HTMLElement>("#hint-capture");
  if (hint) hint.textContent = formatCombo(manager.getCombo("capture-screen"));
  const regionHint = document.querySelector<HTMLElement>("#hint-region");
  if (regionHint) regionHint.textContent = formatCombo(manager.getCombo("region-capture"));
}

/* =========================================================
 * 탭 전환
 * ========================================================= */

function switchTab(name: string): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll<HTMLElement>(".panel").forEach((p) => {
    p.classList.toggle("active", p.dataset.panel === name);
  });
}

/* =========================================================
 * 액션 (단축키 대상)
 * ========================================================= */

async function doExport(): Promise<void> {
  if (!requireImage()) return;
  const format = $<HTMLSelectElement>("#export-format").value as ExportFormat;
  await withBusy("이미지를 저장하고 있어요…", async () => {
    await downloadCanvas(renderExport().canvas, format);
  });
  toast("저장했습니다.", "success");
}

async function doCopy(): Promise<void> {
  if (!requireImage()) return;
  try {
    await withBusy("클립보드로 복사하고 있어요…", async () => {
      await copyCanvasToClipboard(renderExport().canvas);
    });
    toast("클립보드에 복사했습니다.", "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "복사에 실패했습니다.", "error");
  }
}

/** 캔버스 편집 상태만 초기화 (촬영 스타일/도장 예약은 유지) */
function clearCanvasEdits(): void {
  filters = defaultFilterParams();
  bg = defaultBackgroundOptions();
  stamps = [];
  selectedStampId = null;
  annotations = [];
  selectedAnnotationId = null;
  setTool(null);
  outputWidth = 0;
  setActiveFilterPreset("none");
  refreshFilterUI();
  syncBackgroundUI();
  renderStampList();
  refreshStampEditor();
  $("#ai-comment").hidden = true;
  requestRender();
}

function resetEdits(): void {
  clearCanvasEdits();
  selectedLookId = "look-none";
  armedStampIds.clear();
  syncLookUI();
  syncFunRow();
  syncArmedNote();
  toast("편집을 초기화했습니다.");
}

function bindActions(): void {
  const firstAiFilter = AI_FILTERS[0];
  const handlers: Record<ActionId, () => void> = {
    "capture-screen": () => void doCaptureScreen(),
    "region-capture": () => void doRegionCapture(),
    "toggle-session": () => void toggleSession(),
    "toggle-widget": () => void toggleWidget(),
    "open-file": () => $<HTMLInputElement>("#file-input").click(),
    "paste-clipboard": () => void doPaste(),
    "export-image": () => void doExport(),
    "copy-image": () => void doCopy(),
    undo,
    "reset-edits": resetEdits,
    "toggle-editor": toggleEditor,
    "ai-enhance": () => void runAiFilter(firstAiFilter.id, firstAiFilter.instruction, firstAiFilter.name),
    "stamp-date": () => addStamp(STAMP_PRESETS.find((p) => p.id === "datetime")!.make()),
    "stamp-seal": () => addStamp(STAMP_PRESETS.find((p) => p.id === "seal-approve")!.make()),
    "cycle-ratio": cycleRatio,
    "auto-trim": () => void doAutoTrim(false),
    "tab-adjust": () => openEditor("adjust"),
    "tab-marks": () => openEditor("marks"),
    "tab-background": () => openEditor("background"),
    "open-settings": toggleSettings,
  };
  for (const [id, fn] of Object.entries(handlers)) manager.on(id as ActionId, fn);

  window.addEventListener("keydown", (e) => {
    // Esc: 위에 떠 있는 창부터 닫기 (녹화 중 Esc 는 매니저가 취소로 처리)
    if (e.key === "Escape" && !manager.isRecording) {
      if (isSettingsOpen()) {
        closeSettings();
        e.preventDefault();
        return;
      }
      if (activeTool) {
        setTool(null);
        e.preventDefault();
        return;
      }
      if (isEditorOpen() && !isEditable(e.target)) {
        closeEditor();
        e.preventDefault();
        return;
      }
    }
    // 선택된 스탬프 삭제 (녹화 중이 아닐 때)
    if ((e.key === "Delete" || e.key === "Backspace") && !manager.isRecording && !isEditable(e.target)) {
      if (selectedAnnotationId) {
        removeAnnotation(selectedAnnotationId);
        e.preventDefault();
        return;
      }
      if (selectedStampId) {
        removeStamp(selectedStampId);
        e.preventDefault();
        return;
      }
    }
    const { handled } = manager.handleKeydown(e, isEditable(e.target));
    if (handled) e.preventDefault();
  });
}

/* =========================================================
 * 입력 소스 배선
 * ========================================================= */

function bindInputSources(): void {
  // 카메라 화면 (캡처 모드)
  $("#shutter").addEventListener("click", () => void doCaptureScreen());
  $("#shutter-region").addEventListener("click", () => void doRegionCapture());
  $("#cam-paste").addEventListener("click", () => void doPaste());
  $("#cam-live").addEventListener("click", () => void toggleSession());
  $("#cam-widget").addEventListener("click", () => void toggleWidget());
  $("#cam-settings").addEventListener("click", () => openSettings());
  $("#deck-toggle").addEventListener("click", toggleDeck);
  $("#shots-save-all").addEventListener("click", () => void saveAllShots());
  $("#shots-clear").addEventListener("click", clearShots);
  $("#act-edit").addEventListener("click", () => openEditor());
  $("#act-crop").addEventListener("click", () => void doCropCurrent());
  $("#act-export").addEventListener("click", () => void doExport());
  $("#act-copy").addEventListener("click", () => void doCopy());
  cameraPreviewEl.addEventListener("click", () => openEditor());

  const fileInput = $<HTMLInputElement>("#file-input");
  $("#cam-open").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) void loadFromBlob(file);
    fileInput.value = "";
  });

  // 편집기 창 툴바
  $("#btn-capture").addEventListener("click", () => void doCaptureScreen());
  $("#empty-capture").addEventListener("click", () => void doCaptureScreen());
  $("#btn-undo").addEventListener("click", undo);
  $("#btn-reset").addEventListener("click", resetEdits);
  $("#btn-export").addEventListener("click", () => void doExport());
  $("#btn-copy").addEventListener("click", () => void doCopy());

  // Ctrl+V 네이티브 붙여넣기
  window.addEventListener("paste", (e) => {
    if (isEditable(e.target)) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          void loadFromBlob(blob);
          return;
        }
      }
    }
  });

  // 드래그 & 드롭
  const overlay = $("#drop-overlay");
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    if (e.dataTransfer?.types.includes("Files")) {
      dragDepth++;
      overlay.hidden = false;
    }
  });
  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.hidden = true;
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
    if (file) void loadFromBlob(file);
  });

  // 탭
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => {
    t.addEventListener("click", () => switchTab(t.dataset.tab!));
  });
}

/* =========================================================
 * 데스크톱 래퍼 연동 (Electron — 전역 단축키/트레이 캡처 수신)
 * ========================================================= */

function setupNative(): void {
  const native = getNative();
  if (!native) return;
  document.body.classList.add("native");

  // 전역 단축키 설정 UI
  $("#native-settings").hidden = false;
  const quickInput = $<HTMLInputElement>("#ns-quick");
  const editInput = $<HTMLInputElement>("#ns-edit");
  void native.getGlobalShortcuts().then((s) => {
    quickInput.value = s.quick;
    editInput.value = s.edit;
  });
  $("#ns-apply").addEventListener("click", () => {
    void (async () => {
      const res = await native.setGlobalShortcuts({
        quick: quickInput.value.trim(),
        edit: editInput.value.trim(),
      });
      quickInput.value = res.applied.quick;
      editInput.value = res.applied.edit;
      $("#ns-status").textContent = res.ok
        ? "✅ 적용되었습니다. 앱이 백그라운드여도 동작합니다."
        : `⚠️ 등록 실패: ${res.failed.join(", ")} — 형식 오류거나 다른 앱이 사용 중입니다.`;
      toast(
        res.ok ? "전역 단축키를 적용했습니다." : "일부 전역 단축키 등록에 실패했습니다.",
        res.ok ? "success" : "error",
      );
    })();
  });

  // 전역 단축키/트레이에서 캡처된 이미지 수신 → 퀵 파이프라인
  native.onCaptured((payload) => {
    void (async () => {
      try {
        const canvas = await canvasFromDataUrl(payload.dataUrl);
        setBaseCanvas(canvas, { pushHistory: true });
        if (!payload.openEditor && !isEditorOpen()) fireShutterFlash();
        toast(`화면을 캡처했습니다 (${canvas.width}×${canvas.height})`, "success");
        await finishShot();
        if (payload.openEditor) openEditor();
      } catch (err) {
        toast(err instanceof Error ? err.message : "캡처 처리 실패", "error");
      }
    })();
  });
}

/* =========================================================
 * 프로그램 창 — 드래그 이동 / 신호등 버튼
 * ========================================================= */

function setupWindow(): void {
  const titlebar = $("#titlebar");

  $("#win-close").addEventListener("click", closeEditor);
  $("#win-min").addEventListener("click", closeEditor);
  $("#win-max").addEventListener("click", () => editorWindow.classList.toggle("maximized"));
  titlebar.addEventListener("dblclick", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("button, select, input")) return;
    editorWindow.classList.toggle("maximized");
  });

  let drag: { startX: number; startY: number; left: number; top: number } | null = null;
  titlebar.addEventListener("pointerdown", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("button, select, input")) return;
    if (editorWindow.classList.contains("maximized")) return;
    const rect = editorWindow.getBoundingClientRect();
    drag = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top };
    titlebar.setPointerCapture(e.pointerId);
  });
  titlebar.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const left = clamp(
      drag.left + e.clientX - drag.startX,
      120 - editorWindow.offsetWidth,
      window.innerWidth - 120,
    );
    const top = clamp(drag.top + e.clientY - drag.startY, 0, window.innerHeight - 48);
    editorWindow.style.left = `${left}px`;
    editorWindow.style.top = `${top}px`;
  });
  const endDrag = (e: PointerEvent) => {
    if (drag) {
      titlebar.releasePointerCapture(e.pointerId);
      drag = null;
    }
  };
  titlebar.addEventListener("pointerup", endDrag);
  titlebar.addEventListener("pointercancel", endDrag);
}

/* =========================================================
 * 테스트 훅 (e2e 스모크 테스트용)
 * ========================================================= */

declare global {
  interface Window {
    __cb: {
      loadDataUrl: (dataUrl: string) => Promise<void>;
      exportDataUrl: () => string;
      getState: () => {
        hasImage: boolean;
        baseSize: [number, number] | null;
        filters: FilterParams;
        bg: BackgroundOptions;
        stamps: Stamp[];
        shortcuts: ReturnType<ShortcutManager["getMap"]>;
      };
      applyFilterPreset: (id: string) => void;
      applySmartBackground: (id: string) => void;
      addStampPreset: (id: string) => void;
      autoTrim: () => boolean;
      setRatio: (r: string) => void;
      openEditor: (tab?: string) => void;
      closeEditor: () => void;
      isEditorOpen: () => boolean;
      openSettings: (section?: "capture" | "keys" | "connect") => void;
      closeSettings: () => void;
      isSettingsOpen: () => boolean;
      getSettingsSection: () => string | null;
      sessionActive: () => boolean;
      stopSession: () => void;
      /** e2e: getDisplayMedia 대신 canvas.captureStream 으로 세션 연결 */
      connectSessionForTest: () => Promise<void>;
      setQuickSettings: (partial: Partial<QuickSettings>) => void;
      getQuickSettings: () => QuickSettings;
      isWidgetOpen: () => boolean;
      widgetSupported: () => boolean;
      selectLook: (id: string) => void;
      getLookId: () => string;
      getDeckOpen: () => boolean;
      saveCurrentProfile: (name: string) => { id: string; name: string } | null;
      getProfiles: () => { id: string; name: string; stamps: number; outputWidth: number }[];
      getLastProfileId: () => string | null;
      getOutputWidth: () => number;
      toggleArmedStamp: (id: string) => void;
      getArmedStamps: () => string[];
      setTool: (kind: AnnotationKind | null) => void;
      getTool: () => string | null;
      addAnnotation: (
        kind: AnnotationKind,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
      ) => void;
      getAnnotations: () => Annotation[];
      clearAnnotations: () => void;
    };
  }
}

function exposeTestHook(): void {
  window.__cb = {
    loadDataUrl: async (dataUrl) => {
      const canvas = await canvasFromDataUrl(dataUrl);
      setBaseCanvas(canvas, { pushHistory: true });
    },
    exportDataUrl: () => renderExport().canvas.toDataURL("image/png"),
    getState: () => ({
      hasImage: !!baseCanvas,
      baseSize: baseCanvas ? [baseCanvas.width, baseCanvas.height] : null,
      filters,
      bg,
      stamps,
      shortcuts: manager.getMap(),
    }),
    applyFilterPreset,
    applySmartBackground,
    addStampPreset: (id) => {
      const preset = STAMP_PRESETS.find((p) => p.id === id);
      if (preset) addStamp(preset.make());
    },
    autoTrim: () => doAutoTrim(false),
    setRatio,
    openEditor,
    closeEditor,
    isEditorOpen,
    openSettings,
    closeSettings,
    isSettingsOpen,
    getSettingsSection: () =>
      document.querySelector<HTMLElement>(".sect.active")?.dataset.sect ?? null,
    sessionActive: () => session.active,
    stopSession: () => session.stop(),
    connectSessionForTest: async () => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 200;
      const ctx = c.getContext("2d")!;
      let n = 0;
      const iv = setInterval(() => {
        ctx.fillStyle = `hsl(${(n++ * 7) % 360} 80% 60%)`;
        ctx.fillRect(0, 0, c.width, c.height);
      }, 40);
      const stream = c.captureStream(20);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => clearInterval(iv));
      await session.connect(() => Promise.resolve(stream));
    },
    setQuickSettings: (partial) => {
      settings.quick = { ...settings.quick, ...partial };
      saveSettings(settings);
      refreshQuickChip();
    },
    getQuickSettings: () => ({ ...settings.quick }),
    isWidgetOpen: () => widget !== null,
    widgetSupported: isWidgetSupported,
    selectLook,
    getLookId: () => selectedLookId,
    getDeckOpen: () => settings.deckOpen,
    saveCurrentProfile: (name) => {
      const p = saveCurrentProfile(name);
      return p ? { id: p.id, name: p.name } : null;
    },
    getProfiles: () =>
      settings.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        stamps: p.stamps.length,
        outputWidth: p.outputWidth,
      })),
    getLastProfileId: () => (settings.lastProfile ? settings.lastProfile.id : null),
    getOutputWidth: () => outputWidth,
    toggleArmedStamp: (id) => {
      if (armedStampIds.has(id)) armedStampIds.delete(id);
      else armedStampIds.add(id);
      syncFunRow();
      syncArmedNote();
    },
    getArmedStamps: () => [...armedStampIds],
    setTool,
    getTool: () => activeTool,
    addAnnotation: (kind, x1, y1, x2, y2) => {
      annotations.push(createAnnotation(kind, x1, y1, x2, y2, { color: annoColor, size: annoSize }));
      syncAnnotationUI();
      requestRender();
    },
    getAnnotations: () => annotations.map((a) => ({ ...a })),
    clearAnnotations,
  };
}

/* =========================================================
 * 아이콘 하이드레이션 — 크롬(버튼/칩)을 일관된 SVG 아이콘으로
 * ========================================================= */

function setupIcons(): void {
  type Entry = [string, Parameters<typeof icon>[0], string?, number?];
  const entries: Entry[] = [
    ["#brand-logo", "camera", undefined, 18],
    ["#cam-settings", "gear", undefined, 18],
    ["#cam-open", "folder", undefined, 20],
    ["#cam-paste", "clipboard", undefined, 20],
    ["#deck-toggle", "sliders", "도구"],
    ["#cam-live", "link", "연속 캡처"],
    ["#cam-widget", "pin", "위젯"],
    ["#qk-chip", "zap", "캡처 후"],
    ["#act-edit", "pencil", "편집"],
    ["#act-crop", "crop", "자르기"],
    ["#act-export", "download", "저장"],
    ["#act-copy", "copy", "복사"],
    ["#btn-capture", "camera"],
    ["#btn-undo", "undo"],
    ["#btn-reset", "eraser"],
    ["#btn-export", "download", "저장"],
    ["#btn-copy", "copy"],
    ["#settings-close", "x", undefined, 15],
    ["#empty-icon", "camera", undefined, 40],
    ["#empty-capture", "camera", "화면 캡처"],
    ["#btn-auto-trim", "crop", "자동 여백 제거"],
    ["#qt-copy", "copy", undefined, 13],
    ["#qt-save", "download", undefined, 13],
    ["#qt-edit", "pencil", undefined, 13],
    ["#qt-close", "x", undefined, 13],
    ["#shots-save-all", "download", "모두", 13],
    ["#shots-clear", "trash", undefined, 13],
  ];
  for (const [sel, name, label, size] of entries) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) applyIcon(el, name, label, size ?? 16);
  }
}

/* =========================================================
 * 부트스트랩
 * ========================================================= */

function init(): void {
  setupIcons();
  buildFilterPanel();
  buildAiPanel();
  buildStampPanel();
  buildAnnotationPanel();
  buildBackgroundPanel();
  buildSettingsWindow();
  buildHomeDeck();
  applyDeckState();
  bindActions();
  bindInputSources();
  setupCanvasInteraction();
  setupWindow();
  setupQuickThumb();
  setupNative();
  session.onStateChange = syncSessionUI;
  syncSessionUI();
  renderStampList();
  syncBackgroundUI();
  exposeTestHook();
}

init();
