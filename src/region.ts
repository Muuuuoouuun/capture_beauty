/**
 * 영역 선택 오버레이 — Win+Shift+S / macOS Cmd+Shift+4 스타일.
 * 전체 스크린샷 위에서 드래그로 영역을 고르면(점선 마칭앤츠 + 바깥 어둡게 + 크기 배지)
 * 이미지 좌표계의 사각형을 돌려준다. Esc 취소, 마우스를 떼는 순간 확정.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ContainFit {
  scale: number;
  dispW: number;
  dispH: number;
  offsetX: number;
  offsetY: number;
}

/** 이미지(imgW×imgH)를 뷰포트(vw×vh)에 contain 맞춤했을 때의 배율/오프셋 */
export function fitContain(imgW: number, imgH: number, vw: number, vh: number): ContainFit {
  const scale = Math.min(vw / imgW, vh / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  return { scale, dispW, dispH, offsetX: (vw - dispW) / 2, offsetY: (vh - dispH) / 2 };
}

/** 임의 방향 드래그(시작/끝) → 정규화된 사각형 */
export function normRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

/** 화면(뷰포트) 좌표 사각형 → 이미지 픽셀 사각형 (반올림 + 이미지 경계로 클램프) */
export function displayToImageRect(rect: Rect, fit: ContainFit, imgW: number, imgH: number): Rect {
  const x1 = (rect.x - fit.offsetX) / fit.scale;
  const y1 = (rect.y - fit.offsetY) / fit.scale;
  const x2 = (rect.x + rect.w - fit.offsetX) / fit.scale;
  const y2 = (rect.y + rect.h - fit.offsetY) / fit.scale;
  const cx1 = Math.max(0, Math.min(imgW, Math.round(x1)));
  const cy1 = Math.max(0, Math.min(imgH, Math.round(y1)));
  const cx2 = Math.max(0, Math.min(imgW, Math.round(x2)));
  const cy2 = Math.max(0, Math.min(imgH, Math.round(y2)));
  return { x: cx1, y: cy1, w: cx2 - cx1, h: cy2 - cy1 };
}

const MIN_SELECT_PX = 4; // 이미지 픽셀 기준 최소 선택 크기

/**
 * 오버레이를 띄우고 사용자의 영역 선택을 기다린다.
 * 반환: 이미지 좌표 사각형, 취소(Esc/너무 작은 선택)면 null.
 */
export function selectRegion(source: HTMLCanvasElement): Promise<Rect | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "region-overlay";
    overlay.id = "region-overlay";

    const shot = document.createElement("canvas");
    shot.className = "region-shot";

    const dims = ["top", "left", "right", "bottom"].map((side) => {
      const d = document.createElement("div");
      d.className = `region-dim ${side}`;
      return d;
    });

    const box = document.createElement("div");
    box.className = "region-box";
    box.hidden = true;
    box.innerHTML =
      `<svg class="region-ants" width="100%" height="100%" preserveAspectRatio="none">` +
      `<rect x="0.5" y="0.5" fill="none" /></svg>` +
      `<span class="region-size"></span>`;

    const hint = document.createElement("div");
    hint.className = "region-hint";
    hint.textContent = "드래그로 캡처할 영역을 선택하세요 · Esc 취소";

    overlay.append(shot, ...dims, box, hint);
    document.body.appendChild(overlay);

    const imgW = source.width;
    const imgH = source.height;
    let fit = fitContain(imgW, imgH, window.innerWidth, window.innerHeight);

    const renderShot = () => {
      fit = fitContain(imgW, imgH, window.innerWidth, window.innerHeight);
      shot.width = Math.max(1, Math.round(fit.dispW));
      shot.height = Math.max(1, Math.round(fit.dispH));
      shot.style.left = `${fit.offsetX}px`;
      shot.style.top = `${fit.offsetY}px`;
      const ctx = shot.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, shot.width, shot.height);
    };
    renderShot();

    let start: { x: number; y: number } | null = null;
    let current: Rect | null = null;

    const sizeLabel = box.querySelector<HTMLElement>(".region-size")!;
    const antsRect = box.querySelector<SVGRectElement>(".region-ants rect")!;

    const layout = (r: Rect) => {
      box.hidden = false;
      box.style.left = `${r.x}px`;
      box.style.top = `${r.y}px`;
      box.style.width = `${r.w}px`;
      box.style.height = `${r.h}px`;
      antsRect.setAttribute("width", String(Math.max(0, r.w - 1)));
      antsRect.setAttribute("height", String(Math.max(0, r.h - 1)));
      const imgRect = displayToImageRect(r, fit, imgW, imgH);
      sizeLabel.textContent = `${imgRect.w} × ${imgRect.h}`;
      // 바깥 어둡게 (4분할)
      const [top, left, right, bottom] = dims;
      top.style.cssText = `left:0;top:0;width:100%;height:${r.y}px`;
      bottom.style.cssText = `left:0;top:${r.y + r.h}px;width:100%;bottom:0;height:auto`;
      left.style.cssText = `left:0;top:${r.y}px;width:${r.x}px;height:${r.h}px`;
      right.style.cssText = `left:${r.x + r.w}px;top:${r.y}px;right:0;width:auto;height:${r.h}px`;
    };

    const dimAll = () => {
      const [top, left, right, bottom] = dims;
      top.style.cssText = "inset:0;width:100%;height:100%";
      left.style.cssText = right.style.cssText = bottom.style.cssText = "display:none";
    };
    dimAll();

    const finish = (result: Rect | null) => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", renderShot);
      overlay.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", renderShot);

    overlay.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY };
      overlay.setPointerCapture(e.pointerId);
      hint.hidden = true;
    });
    overlay.addEventListener("pointermove", (e) => {
      if (!start) return;
      current = normRect(start.x, start.y, e.clientX, e.clientY);
      layout(current);
    });
    overlay.addEventListener("pointerup", () => {
      if (!start || !current) {
        // 클릭만 하고 드래그 없음 — 계속 대기
        start = null;
        return;
      }
      const imgRect = displayToImageRect(current, fit, imgW, imgH);
      if (imgRect.w < MIN_SELECT_PX || imgRect.h < MIN_SELECT_PX) {
        start = null;
        current = null;
        box.hidden = true;
        dimAll();
        hint.hidden = false;
        return;
      }
      finish(imgRect);
    });
  });
}
