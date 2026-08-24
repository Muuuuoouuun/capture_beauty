/**
 * 브라우저 스모크 테스트 (실제 Chromium 에서 앱 전체 파이프라인 검증)
 * 사전 조건: `npm run build` 로 dist/ 가 생성되어 있어야 함
 * 실행: npm run e2e
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 4173;
const CHROMIUM =
  process.env.E2E_CHROMIUM ?? "/opt/pw-browsers/chromium";

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not start: ${url}`);
}

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
  detached: false,
});

let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  console.log("서버 준비 완료, 브라우저 실행…");

  browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (err) => {
    failures++;
    console.error(`  ❌ 페이지 오류: ${err.message}`);
  });

  await page.goto(`http://localhost:${PORT}/`);

  console.log("\n[1] 앱 로드");
  check("타이틀", (await page.title()).includes("Capture Beauty"));
  check("탭 5개", (await page.locator(".tab").count()) === 5);
  check("빈 상태 표시", await page.locator("#empty-state").isVisible());
  check("테스트 훅 노출", await page.evaluate(() => typeof window.__cb === "object"));

  console.log("\n[2] 이미지 로드 (테스트 이미지 생성 → 주입)");
  await page.evaluate(async () => {
    // 40px 흰 테두리 + 320×180 색 콘텐츠 (자동 트림 검증용)
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 260;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 260);
    const g = ctx.createLinearGradient(40, 40, 360, 220);
    g.addColorStop(0, "#3355ff");
    g.addColorStop(1, "#ff5533");
    ctx.fillStyle = g;
    ctx.fillRect(40, 40, 320, 180);
    await window.__cb.loadDataUrl(c.toDataURL("image/png"));
  });
  let state = await page.evaluate(() => window.__cb.getState());
  check("이미지 로드됨", state.hasImage);
  check("원본 크기 400×260", state.baseSize?.[0] === 400 && state.baseSize?.[1] === 260,
    JSON.stringify(state.baseSize));
  check("미리보기 캔버스 표시", await page.locator("#preview").isVisible());

  console.log("\n[3] 자동 여백 제거 (배경 필터 — 창 밖 정리)");
  const trimmed = await page.evaluate(() => window.__cb.autoTrim());
  state = await page.evaluate(() => window.__cb.getState());
  check("트림 실행됨", trimmed === true);
  check("트림 후 320×180", state.baseSize?.[0] === 320 && state.baseSize?.[1] === 180,
    JSON.stringify(state.baseSize));

  console.log("\n[4] 필터 적용 (흑백 프리셋 → 픽셀 검증)");
  await page.evaluate(() => window.__cb.applyFilterPreset("mono"));
  const monoPixel = await page.evaluate(async () => {
    const url = window.__cb.exportDataUrl();
    const img = new Image();
    await new Promise((res) => {
      img.onload = res;
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  check(
    "중앙 픽셀이 무채색(R=G=B)",
    monoPixel[0] === monoPixel[1] && monoPixel[1] === monoPixel[2],
    JSON.stringify(monoPixel),
  );

  console.log("\n[5] 스탬프");
  await page.evaluate(() => window.__cb.addStampPreset("seal-approve"));
  state = await page.evaluate(() => window.__cb.getState());
  check("도장 스탬프 추가", state.stamps.length === 1 && state.stamps[0].style === "seal");
  // 단축키로 날짜 스탬프 추가 (기본값 T)
  await page.locator("body").press("t");
  state = await page.evaluate(() => window.__cb.getState());
  check("단축키 T 로 날짜 스탬프 추가", state.stamps.length === 2);
  check("스탬프 목록 UI 반영", (await page.locator("#stamp-list li:not(.empty)").count()) === 2);

  console.log("\n[6] 스마트 배경 필터 (16:9 프레젠테이션)");
  await page.evaluate(() => window.__cb.applySmartBackground("smart-presentation"));
  state = await page.evaluate(() => window.__cb.getState());
  check("비율 16:9 세팅", state.bg.ratio === "16:9");
  check("배경 프리셋 세팅", state.bg.preset === "ocean");
  const exportSize = await page.evaluate(async () => {
    const url = window.__cb.exportDataUrl();
    const img = new Image();
    await new Promise((res) => {
      img.onload = res;
      img.src = url;
    });
    return [img.width, img.height];
  });
  check(
    "출력이 정확히 16:9",
    Math.abs(exportSize[0] / exportSize[1] - 16 / 9) < 0.01,
    JSON.stringify(exportSize),
  );

  console.log("\n[7] 단축키 UI/충돌 처리");
  await page.locator("body").press("5"); // 설정 탭
  check("숫자키로 탭 전환", await page.locator('[data-panel="settings"]').evaluate(
    (el) => el.classList.contains("active"),
  ));
  // 첫 번째 항목(화면 캡처) 녹화 → F9 입력
  await page.locator("#shortcut-list li >> nth=0 >> .shortcut-key").click();
  check(
    "녹화 모드 진입",
    await page.locator("#shortcut-list li >> nth=0 >> .shortcut-key").evaluate((el) =>
      el.classList.contains("recording"),
    ),
  );
  await page.locator("body").press("F9");
  const rebound = await page.evaluate(() => window.__cb.getState().shortcuts["capture-screen"]);
  check("F9 로 재할당", rebound?.key === "F9", JSON.stringify(rebound));
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("capture-beauty:settings:v1") ?? "{}"),
  );
  check("단축키 localStorage 저장", persisted?.shortcuts?.["capture-screen"]?.key === "F9");

  console.log("\n[8] AI 패널 (키 없음 상태)");
  await page.locator("body").press("2");
  check("API 키 경고 표시", await page.locator("#ai-key-warning").isVisible());
  check("AI 필터 버튼 5개", (await page.locator(".ai-filter").count()) === 5);

  if (failures === 0) {
    console.log("\n🎉 e2e 스모크 테스트 전체 통과");
  } else {
    console.error(`\n❌ 실패 ${failures}건`);
  }
} catch (err) {
  failures++;
  console.error("e2e 실행 오류:", err);
} finally {
  await browser?.close().catch(() => {});
  server.kill("SIGTERM");
}
process.exit(failures === 0 ? 0 : 1);
