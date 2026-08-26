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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (err) => {
    failures++;
    console.error(`  ❌ 페이지 오류: ${err.message}`);
  });

  await page.goto(`http://localhost:${PORT}/`);

  console.log("\n[1] 캡처 모드 (사진기 화면) 로드 — 기본은 미니멀");
  check("타이틀", (await page.title()).includes("Capture Beauty"));
  check("셔터 버튼 표시", await page.locator("#shutter").isVisible());
  check("영역 캡처 버튼 표시", await page.locator("#shutter-region").isVisible());
  check("카메라 그래픽(SVG) 표시", await page.locator(".vf-camera").isVisible());
  check("도구 덱은 기본 접힘 (미니멀)", await page.locator("#home-deck").isHidden());
  check(
    "요약엔 설정된 요소만 (퀵 칩 1개)",
    (await page.locator("#deck-summary .chip").count()) === 1,
  );
  check("편집 창은 닫힘 상태", await page.locator("#editor-backdrop").isHidden());
  check("테스트 훅 노출", await page.evaluate(() => typeof window.__cb === "object"));

  console.log("\n[2] 캡처 (테스트 이미지 주입) → 사진 리뷰 상태");
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
  check("뷰파인더에 찍은 사진 표시", await page.locator("#camera-preview").isVisible());
  check("편집/저장/복사 액션 바 표시", await page.locator("#capture-actions").isVisible());

  console.log("\n[3] '편집' → 프로그램 창 열림");
  await page.locator("#act-edit").click();
  check("편집 창 표시", await page.locator("#editor-window").isVisible());
  check("신호등 버튼 3개", (await page.locator(".titlebar .light").count()) === 3);
  check("탭 5개", (await page.locator(".tab").count()) === 5);
  check("미리보기 캔버스 표시", await page.locator("#preview").isVisible());

  console.log("\n[4] 자동 여백 제거 (배경 필터 — 창 밖 정리)");
  const trimmed = await page.evaluate(() => window.__cb.autoTrim());
  state = await page.evaluate(() => window.__cb.getState());
  check("트림 실행됨", trimmed === true);
  check("트림 후 320×180", state.baseSize?.[0] === 320 && state.baseSize?.[1] === 180,
    JSON.stringify(state.baseSize));

  console.log("\n[5] 필터 적용 (흑백 프리셋 → 픽셀 검증)");
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

  console.log("\n[6] 스탬프");
  await page.evaluate(() => window.__cb.addStampPreset("seal-approve"));
  state = await page.evaluate(() => window.__cb.getState());
  check("도장 스탬프 추가", state.stamps.length === 1 && state.stamps[0].style === "seal");
  // 단축키로 날짜 스탬프 추가 (기본값 T)
  await page.locator("body").press("t");
  state = await page.evaluate(() => window.__cb.getState());
  check("단축키 T 로 날짜 스탬프 추가", state.stamps.length === 2);
  check("스탬프 목록 UI 반영", (await page.locator("#stamp-list li:not(.empty)").count()) === 2);

  console.log("\n[7] 스마트 배경 필터 (16:9 프레젠테이션)");
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

  console.log("\n[8] 단축키 UI/충돌 처리");
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

  console.log("\n[9] 창 동작 (닫기/단축키 토글/드래그)");
  const beforeDrag = await page.locator("#editor-window").boundingBox();
  await page.mouse.move(beforeDrag.x + 300, beforeDrag.y + 14);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 380, beforeDrag.y + 74, { steps: 4 });
  await page.mouse.up();
  const afterDrag = await page.locator("#editor-window").boundingBox();
  check(
    "타이틀바 드래그로 창 이동",
    Math.round(afterDrag.x - beforeDrag.x) === 80 && Math.round(afterDrag.y - beforeDrag.y) === 60,
    JSON.stringify({ before: beforeDrag, after: afterDrag }),
  );
  await page.locator("#win-close").click();
  check("빨간 버튼으로 창 닫기 → 캡처 화면 복귀", await page.locator("#editor-backdrop").isHidden());
  await page.locator("body").press("e"); // toggle-editor 기본 단축키
  check("단축키 E 로 편집 창 다시 열기", await page.locator("#editor-window").isVisible());

  console.log("\n[10] AI 패널 (키 없음 상태)");
  await page.locator("body").press("2");
  check("API 키 경고 표시", await page.locator("#ai-key-warning").isVisible());
  check("AI 필터 버튼 5개", (await page.locator(".ai-filter").count()) === 5);

  console.log("\n[11] 연속 캡처 세션 (스트림 주입 → 선택창 없는 즉시 캡처)");
  await page.locator("#win-close").click(); // 캡처 화면으로 복귀
  await page.evaluate(() => window.__cb.setQuickSettings({ enabled: false }));
  check("초기 세션 비활성", (await page.evaluate(() => window.__cb.sessionActive())) === false);
  // 헤드리스에는 캡처할 실제 화면이 없으므로 canvas.captureStream 을 주입해
  // getDisplayMedia 이후의 전체 파이프라인(유지/즉시 grab/해제/UI)을 검증한다
  await page.evaluate(() => window.__cb.connectSessionForTest());
  check("세션 연결됨", await page.evaluate(() => window.__cb.sessionActive()));
  check("LIVE 배지 표시", await page.locator("#live-badge").isVisible());
  check(
    "연결 버튼이 해제 상태로 전환",
    (await page.locator("#cam-live").textContent())?.includes("해제"),
  );
  await page.locator("#shutter").click(); // 선택창 없이 즉시 캡처
  await page.waitForTimeout(400);
  let capState = await page.evaluate(() => window.__cb.getState());
  check(
    "즉시 캡처 결과가 스트림 크기(320×200)와 일치",
    capState.baseSize?.[0] === 320 && capState.baseSize?.[1] === 200,
    JSON.stringify(capState.baseSize),
  );
  await page.locator("#shutter").click(); // 연속 촬영에도 세션 유지
  await page.waitForTimeout(300);
  check("연속 촬영 후에도 세션 유지", await page.evaluate(() => window.__cb.sessionActive()));

  console.log("\n[12] 퀵 캡처 (자동 동작 + 플로팅 썸네일)");
  await page.evaluate(() =>
    window.__cb.setQuickSettings({
      enabled: true,
      autoTrim: false,
      autoCopy: false,
      autoSave: false,
      thumbnailSec: 8,
    }),
  );
  await page.locator("#shutter").click();
  await page.waitForTimeout(500);
  check("플로팅 썸네일 표시", await page.locator("#quick-thumb").isVisible());
  await page.locator("#qt-close").click();
  await page.waitForTimeout(400);
  check("썸네일 닫기", await page.locator("#quick-thumb").isHidden());
  // 미니멀 모드: 접힌 덱 대신 요약의 LIVE 칩으로 세션 해제
  check("요약에 LIVE 칩 표시", await page.locator("#deck-summary .chip.live").isVisible());
  await page.locator("#deck-summary .chip.live").click();
  await page.waitForTimeout(200);
  check("세션 해제됨", (await page.evaluate(() => window.__cb.sessionActive())) === false);
  check("LIVE 배지 사라짐", await page.locator("#live-badge").isHidden());

  console.log("\n[13] PiP 위젯 (지원 브라우저에서만)");
  await page.locator("#deck-toggle").click(); // 덱 펼치기 (이후 단계들도 사용)
  check("덱 펼침", await page.locator("#home-deck").isVisible());
  const widgetSupported = await page.evaluate(() => window.__cb.widgetSupported());
  if (widgetSupported) {
    await page.locator("#cam-widget").click();
    await page.waitForTimeout(600);
    check("위젯 열림", await page.evaluate(() => window.__cb.isWidgetOpen()));
    await page.locator("#cam-widget").click();
    await page.waitForTimeout(400);
    check("위젯 닫힘", (await page.evaluate(() => window.__cb.isWidgetOpen())) === false);
  } else {
    console.log("  ⏭️ Document PiP 미지원 환경 — 위젯 테스트 건너뜀 (지원 감지 로직은 통과)");
  }

  console.log("\n[14] 홈 덱 — 룩 즉시 적용 (이미지 있음)");
  check("덱 여전히 펼침", await page.locator("#home-deck").isVisible());
  check("룩 카드 9개", (await page.locator("#look-row .look-card").count()) === 9);
  check("도장 칩 7개", (await page.locator("#fun-row .chip").count()) === 7);
  await page.locator("body").press("Shift+X"); // 편집 초기화
  await page.locator('[data-look="look-cinema"]').click();
  state = await page.evaluate(() => window.__cb.getState());
  check("시네마 룩: 필터 적용", state.filters.contrast === 18, JSON.stringify(state.filters));
  check(
    "시네마 룩: 배경/비율 적용",
    state.bg.preset === "midnight" && state.bg.ratio === "16:9",
    JSON.stringify({ preset: state.bg.preset, ratio: state.bg.ratio }),
  );
  check("룩 카드 활성 표시", await page.locator('[data-look="look-cinema"]').evaluate(
    (el) => el.classList.contains("active"),
  ));

  console.log("\n[15] 홈 덱 — 다음 샷 예약 (이미지 없음, 리로드 후)");
  await page.reload();
  await page.waitForTimeout(400);
  check("리로드 후 이미지 없음", (await page.evaluate(() => window.__cb.getState())).hasImage === false);
  check("덱 펼침 상태가 유지됨 (localStorage)", await page.evaluate(() => window.__cb.getDeckOpen()));
  await page.locator('[data-look="look-cinema"]').click(); // 룩 예약
  await page.locator('[data-stamp-chip="seal-approve"]').click(); // 도장 예약
  check("도장 칩 armed 표시", await page.locator('[data-stamp-chip="seal-approve"]').evaluate(
    (el) => el.classList.contains("armed"),
  ));
  check("다음 샷 안내 표시", await page.locator("#armed-note").isVisible());
  await page.evaluate(() => window.__cb.connectSessionForTest());
  await page.locator("#shutter").click(); // 촬영 → 룩+도장 자동 적용
  await page.waitForTimeout(500);
  state = await page.evaluate(() => window.__cb.getState());
  check("샷에 룩 자동 적용", state.filters.contrast === 18 && state.bg.preset === "midnight");
  check("샷에 도장 자동 추가", state.stamps.length === 1 && state.stamps[0].style === "seal",
    JSON.stringify(state.stamps.map((s) => s.style)));
  check("도장 예약은 소진됨", (await page.evaluate(() => window.__cb.getArmedStamps())).length === 0);
  check("룩은 촬영 모드로 유지", (await page.evaluate(() => window.__cb.getLookId())) === "look-cinema");
  await page.evaluate(() => window.__cb.stopSession());

  console.log("\n[16] 퀵 칩 상태 표시");
  await page.evaluate(() => window.__cb.setQuickSettings({ enabled: true, autoCopy: true, autoSave: false, autoTrim: false, thumbnailSec: 6 }));
  check("퀵 칩: 복사 표시", (await page.locator("#qk-chip").textContent())?.includes("복사"));
  await page.evaluate(() => window.__cb.setQuickSettings({ enabled: false }));
  check("퀵 칩: 꺼짐 표시", (await page.locator("#qk-chip").textContent())?.includes("꺼짐"));

  console.log("\n[17] 영역 캡처 (점선 오버레이 드래그)");
  await page.evaluate(() => {
    window.__cb.selectLook("look-none");
    return window.__cb.connectSessionForTest();
  });
  await page.locator("#shutter-region").click();
  await page.waitForTimeout(500);
  check("오버레이 표시", await page.locator("#region-overlay").isVisible());
  check("점선(마칭앤츠) 테두리 요소 존재", (await page.locator(".region-ants rect").count()) === 1);
  // 320×200 스트림이 1440×900 뷰포트에 contain → 정확히 4.5배, 오프셋 0
  // (450,225)→(900,450) 드래그 = 이미지 (100,50)~(200,100) → 100×50 픽셀
  await page.mouse.move(450, 225);
  await page.mouse.down();
  await page.mouse.move(700, 350, { steps: 4 });
  const sizeBadge = await page.locator(".region-size").textContent();
  check("크기 배지 실시간 표시", /\d+ × \d+/.test(sizeBadge ?? ""), sizeBadge ?? "");
  await page.mouse.move(900, 450, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  check("오버레이 닫힘", (await page.locator("#region-overlay").count()) === 0);
  state = await page.evaluate(() => window.__cb.getState());
  check(
    "선택 영역만 캡처됨 (100×50)",
    state.baseSize?.[0] === 100 && state.baseSize?.[1] === 50,
    JSON.stringify(state.baseSize),
  );

  console.log("\n[18] 현재 사진 자르기 + Esc 취소");
  await page.locator("#act-crop").click();
  await page.waitForTimeout(300);
  check("자르기 오버레이 표시", await page.locator("#region-overlay").isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("Esc 로 취소", (await page.locator("#region-overlay").count()) === 0);
  state = await page.evaluate(() => window.__cb.getState());
  check("취소 시 이미지 유지", state.baseSize?.[0] === 100 && state.baseSize?.[1] === 50);
  await page.evaluate(() => window.__cb.stopSession());

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
