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
} from "./stamps";
import {
  ACTIONS,
  formatCombo,
  ShortcutManager,
  type ActionId,
} from "./shortcuts";
import { loadSettings, saveSettings, type AppSettings } from "./settings";
import { canvasFromBlob, canvasFromClipboard, canvasFromDataUrl, captureScreen } from "./capture";
import {
  cropCanvas,
  downscaleCanvas,
  invalidateFilterCache,
  rawFromCanvas,
  renderComposite,
  type RenderResult,
} from "./render";
import {
  canvasToAnalysisBase64,
  canvasToBlob,
  copyCanvasToClipboard,
  downloadCanvas,
  type ExportFormat,
} from "./exporter";
import { CaptureSession, type QuickSettings } from "./quickcapture";
import { isWidgetSupported, openWidget, type WidgetHandle } from "./widget";
import { getNative } from "./native";
import {
  AI_FILTERS,
  adjustmentsToFilterParams,
  analyzeImage,
  transformViaEndpoint,
} from "./ai";

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
let activeFilterPresetId = "none";
const history: HTMLCanvasElement[] = []; // 파괴적 작업(트림/AI 변환/새 이미지) 되돌리기
const MAX_HISTORY = 10;

const settings: AppSettings = loadSettings();
const manager = new ShortcutManager(settings.shortcuts ?? undefined);
const session = new CaptureSession();
let widget: WidgetHandle | null = null;

const PREVIEW_MAX_DIM = 1600;

/* =========================================================
 * DOM 헬퍼
 * ========================================================= */

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

const previewEl = $<HTMLCanvasElement>("#preview");
const emptyState = $("#empty-state");
const canvasWrap = $("#canvas-wrap");
const statusbar = $("#statusbar");
const cameraPreviewEl = $<HTMLCanvasElement>("#camera-preview");
const vfHint = $("#vf-hint");
const captureActions = $("#capture-actions");
const editorBackdrop = $("#editor-backdrop");
const editorWindow = $("#editor-window");

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
  const result = renderComposite(
    { source: previewSource, filters, background: bg, stamps },
    `prev-${baseVersion}`,
  );
  lastRender = result;
  previewEl.width = result.canvas.width;
  previewEl.height = result.canvas.height;
  previewEl.getContext("2d")!.drawImage(result.canvas, 0, 0);
  // 카메라 뷰파인더에도 같은 결과 표시 (찍은 사진 리뷰)
  cameraPreviewEl.width = result.canvas.width;
  cameraPreviewEl.height = result.canvas.height;
  cameraPreviewEl.getContext("2d")!.drawImage(result.canvas, 0, 0);
  updateStatus(result);
}

/** 저장/복사용 풀해상도 합성 */
function renderExport(): RenderResult {
  if (!baseCanvas) throw new Error("이미지가 없습니다.");
  invalidateFilterCache(); // 미리보기 캐시와 해상도가 다르므로 새로 계산
  const result = renderComposite(
    { source: baseCanvas, filters, background: bg, stamps },
    `full-${baseVersion}`,
  );
  invalidateFilterCache();
  return result;
}

function updateStatus(result: RenderResult): void {
  if (!baseCanvas) return;
  $("#status-size").textContent = `원본 ${baseCanvas.width}×${baseCanvas.height}`;
  const scale = baseCanvas.width / (previewSource?.width ?? baseCanvas.width);
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
  if (stamps.length) notes.push(`스탬프 ${stamps.length}개`);
  $("#status-note").textContent = notes.join(" · ");
}

function setBaseCanvas(canvas: HTMLCanvasElement, opts: { pushHistory?: boolean } = {}): void {
  if (opts.pushHistory && baseCanvas) pushHistory();
  baseCanvas = canvas;
  baseVersion++;
  previewSource = downscaleCanvas(canvas, PREVIEW_MAX_DIM);
  invalidateFilterCache();
  emptyState.hidden = true;
  canvasWrap.hidden = false;
  statusbar.hidden = false;
  // 카메라 뷰: 힌트 → 찍은 사진 + 액션 바
  vfHint.hidden = true;
  cameraPreviewEl.hidden = false;
  captureActions.hidden = false;
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
    await runQuickActions(fromWindow);
  } catch (err) {
    toast(err instanceof Error ? err.message : "화면 캡처 실패", "error");
  }
}

async function doPaste(): Promise<void> {
  try {
    const canvas = await canvasFromClipboard();
    setBaseCanvas(canvas, { pushHistory: true });
    toast("클립보드 이미지를 불러왔습니다.", "success");
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

async function runQuickActions(fromWindow?: Window): Promise<void> {
  const q = settings.quick;
  if (!q.enabled || !baseCanvas) return;

  if (q.autoTrim) doAutoTrim(true);

  let exported: HTMLCanvasElement | null = null;
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
 * 연속 캡처 세션 + PiP 위젯
 * ========================================================= */

function displayMediaFrom(w: Window): () => Promise<MediaStream> {
  return () => w.navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
}

function syncSessionUI(): void {
  const active = session.active;
  $("#live-badge").hidden = !active;
  const btn = $("#cam-live");
  btn.classList.toggle("active", active);
  btn.textContent = active ? "⛔ 연결 해제" : "🔗 연속 캡처";
  widget?.setSessionActive(active);
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
  });
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
    switchTab("settings");
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
    toast("설정 탭에서 Anthropic API 키를 먼저 입력해주세요.", "error");
    openEditor("settings");
    return;
  }
  try {
    const adjustments = await withBusy(`${label} — 이미지를 분석하고 있어요…`, async () => {
      const { base64, mediaType } = canvasToAnalysisBase64(baseCanvas!);
      return analyzeImage({
        apiKey: settings.apiKey.trim(),
        imageBase64: base64,
        mediaType,
        instruction,
      });
    });
    filters = adjustmentsToFilterParams(adjustments);
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
    toast("설정 탭에서 외부 변환 API URL 을 먼저 입력해주세요.", "error");
    openEditor("settings");
    return;
  }
  const instruction = $<HTMLInputElement>("#ai-endpoint-instruction").value.trim();
  try {
    const resultDataUrl = await withBusy("외부 API 로 이미지를 변환하고 있어요…", () =>
      transformViaEndpoint(endpoint, baseCanvas!.toDataURL("image/png"), instruction),
    );
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

function addStamp(stamp: Stamp): void {
  if (!requireImage()) return;
  stamps.push(stamp);
  selectedStampId = stamp.id;
  renderStampList();
  refreshStampEditor();
  requestRender();
  toast("스탬프를 추가했습니다. 드래그로 위치를 옮겨보세요.", "success");
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

function setupStampDragging(): void {
  let dragging: { id: string; offsetX: number; offsetY: number } | null = null;

  const toCanvasCoords = (e: PointerEvent): { x: number; y: number } => {
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

  previewEl.addEventListener("pointerdown", (e) => {
    const { x, y } = toCanvasCoords(e);
    const id = hitStamp(x, y);
    selectStamp(id);
    if (id && lastRender) {
      const b = lastRender.stampBounds.get(id)!;
      dragging = { id, offsetX: x - b.cx, offsetY: y - b.cy };
      previewEl.classList.add("stamp-drag");
      previewEl.setPointerCapture(e.pointerId);
    }
    requestRender();
  });

  previewEl.addEventListener("pointermove", (e) => {
    const { x, y } = toCanvasCoords(e);
    if (dragging && lastRender) {
      const s = stamps.find((st) => st.id === dragging!.id);
      if (s) {
        const r = lastRender.imageRect;
        s.x = clamp((x - dragging.offsetX - r.x) / r.w, -0.08, 1.08);
        s.y = clamp((y - dragging.offsetY - r.y) / r.h, -0.08, 1.08);
        requestRender();
      }
    } else {
      previewEl.classList.toggle("stamp-hover", hitStamp(x, y) !== null);
    }
  });

  const endDrag = (e: PointerEvent) => {
    if (dragging) {
      previewEl.classList.remove("stamp-drag");
      previewEl.releasePointerCapture(e.pointerId);
      dragging = null;
      renderStampList();
    }
  };
  previewEl.addEventListener("pointerup", endDrag);
  previewEl.addEventListener("pointercancel", endDrag);
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
function applySmartBackground(id: string): void {
  const f = SMART_BACKGROUND_FILTERS.find((x) => x.id === id);
  if (!f || !requireImage()) return;
  const trimmed = f.autoTrim ? doAutoTrim(true) : false;
  bg = { ...bg, ...f.options };
  syncBackgroundUI();
  requestRender();
  toast(`${f.name} 적용${trimmed ? " (여백 자동 제거됨)" : ""}`, "success");
}

/* =========================================================
 * 설정 패널 (단축키 + API 키)
 * ========================================================= */

let cancelRecording: (() => void) | null = null;

function buildSettingsPanel(): void {
  // 퀵 캡처 설정
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
    },
  );
  qkSliders.appendChild(thumbSlider);

  renderShortcutList();

  $("#btn-shortcut-reset").addEventListener("click", () => {
    manager.resetAll();
    renderShortcutList();
    toast("단축키를 기본값으로 되돌렸습니다.", "success");
  });

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
  });

  manager.onChange = (map) => {
    settings.shortcuts = map;
    saveSettings(settings);
    updateShortcutHints();
  };
}

function renderShortcutList(): void {
  const list = $("#shortcut-list");
  list.innerHTML = "";
  for (const action of ACTIONS) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = action.label;

    const keyBtn = document.createElement("button");
    const combo = manager.getCombo(action.id);
    keyBtn.className = `shortcut-key ${combo ? "" : "empty"}`.trim();
    keyBtn.textContent = formatCombo(combo);
    keyBtn.title = "클릭 후 원하는 키를 누르세요";
    keyBtn.addEventListener("click", () => startRecordShortcut(action.id, keyBtn));

    const clearBtn = document.createElement("button");
    clearBtn.className = "shortcut-clear";
    clearBtn.textContent = "✕";
    clearBtn.title = "단축키 해제";
    clearBtn.addEventListener("click", () => {
      manager.clear(action.id);
      renderShortcutList();
    });

    li.append(label, keyBtn, clearBtn);
    list.appendChild(li);
  }
  updateShortcutHints();
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

function resetEdits(): void {
  filters = defaultFilterParams();
  bg = defaultBackgroundOptions();
  stamps = [];
  selectedStampId = null;
  setActiveFilterPreset("none");
  refreshFilterUI();
  syncBackgroundUI();
  renderStampList();
  refreshStampEditor();
  $("#ai-comment").hidden = true;
  requestRender();
  toast("편집을 초기화했습니다.");
}

function bindActions(): void {
  const firstAiFilter = AI_FILTERS[0];
  const handlers: Record<ActionId, () => void> = {
    "capture-screen": () => void doCaptureScreen(),
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
    "tab-filters": () => openEditor("filters"),
    "tab-ai": () => openEditor("ai"),
    "tab-stamps": () => openEditor("stamps"),
    "tab-background": () => openEditor("background"),
    "tab-settings": () => openEditor("settings"),
  };
  for (const [id, fn] of Object.entries(handlers)) manager.on(id as ActionId, fn);

  window.addEventListener("keydown", (e) => {
    // Esc: 편집 창 닫기 (단축키 녹화 중이 아닐 때 — 녹화 취소는 매니저가 처리)
    if (e.key === "Escape" && !manager.isRecording && !isEditable(e.target) && isEditorOpen()) {
      closeEditor();
      e.preventDefault();
      return;
    }
    // 선택된 스탬프 삭제 (녹화 중이 아닐 때)
    if ((e.key === "Delete" || e.key === "Backspace") && !manager.isRecording && !isEditable(e.target)) {
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
  $("#cam-paste").addEventListener("click", () => void doPaste());
  $("#cam-live").addEventListener("click", () => void toggleSession());
  $("#cam-widget").addEventListener("click", () => void toggleWidget());
  $("#cam-settings").addEventListener("click", () => openEditor("settings"));
  $("#act-edit").addEventListener("click", () => openEditor());
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
        await runQuickActions();
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
      sessionActive: () => boolean;
      stopSession: () => void;
      /** e2e: getDisplayMedia 대신 canvas.captureStream 으로 세션 연결 */
      connectSessionForTest: () => Promise<void>;
      setQuickSettings: (partial: Partial<QuickSettings>) => void;
      getQuickSettings: () => QuickSettings;
      isWidgetOpen: () => boolean;
      widgetSupported: () => boolean;
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
    },
    getQuickSettings: () => ({ ...settings.quick }),
    isWidgetOpen: () => widget !== null,
    widgetSupported: isWidgetSupported,
  };
}

/* =========================================================
 * 부트스트랩
 * ========================================================= */

function init(): void {
  buildFilterPanel();
  buildAiPanel();
  buildStampPanel();
  buildBackgroundPanel();
  buildSettingsPanel();
  bindActions();
  bindInputSources();
  setupStampDragging();
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
