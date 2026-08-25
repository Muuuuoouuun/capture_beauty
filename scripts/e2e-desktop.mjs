/**
 * 데스크톱 래퍼(Electron) 스모크 테스트 — Playwright _electron 으로 실제 구동 검증.
 * 사전 조건: `npm run build` (dist/ 필요)
 * 실행: npm run e2e:desktop  (리눅스 헤드리스는 xvfb-run -a npm run e2e:desktop)
 */
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { _electron } = require("playwright-core");
const electronPath = require("electron"); // node 컨텍스트에서는 실행 파일 경로 문자열

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(new URL("../dist/index.html", import.meta.url))) {
  console.error("dist/ 가 없습니다. 먼저 npm run build 를 실행하세요.");
  process.exit(1);
}

let app;
try {
  console.log("Electron 실행…");
  app = await _electron.launch({
    executablePath: electronPath,
    args: ["desktop/main.cjs", "--no-sandbox", "--disable-dev-shm-usage"],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
      // 매 실행 새 userData — 이전 실행이 저장한 단축키 설정에 오염되지 않게
      CAPTURE_BEAUTY_USER_DATA: mkdtempSync(join(tmpdir(), "cb-e2e-")),
    },
  });
  const page = await app.firstWindow();
  page.on("pageerror", (err) => {
    failures++;
    console.error(`  ❌ 렌더러 오류: ${err.message}`);
  });
  await page.waitForLoadState("domcontentloaded");
  await wait(800);

  console.log("\n[1] 창/브리지");
  check("타이틀", (await page.title()).includes("Capture Beauty"));
  check("네이티브 브리지 노출", await page.evaluate(() => window.native?.isNative === true));
  check("전역 단축키 설정 UI 표시", await page.evaluate(() => {
    document.querySelector('[data-tab="settings"]')?.dispatchEvent(new Event("noop"));
    return document.getElementById("native-settings")?.hidden === false;
  }));

  console.log("\n[2] 전역 단축키 등록 (메인 프로세스)");
  const registered = await app.evaluate(({ globalShortcut }) => ({
    quick: globalShortcut.isRegistered("CommandOrControl+Shift+1"),
    edit: globalShortcut.isRegistered("CommandOrControl+Shift+2"),
  }));
  check("빠른 캡처 단축키 등록됨", registered.quick, JSON.stringify(registered));
  check("캡처+편집 단축키 등록됨", registered.edit);

  console.log("\n[3] 선택창 없는 화면 캡처 (desktopCapturer)");
  const capLen = await app.evaluate(async () => {
    const url = await global.__cbMain.captureScreenDataUrl();
    return url.startsWith("data:image/png") ? url.length : 0;
  });
  check("주 화면 캡처 성공 (PNG dataURL)", capLen > 1000, `length=${capLen}`);

  console.log("\n[4] 렌더러 셔터 → captureNow (창 자동 숨김 포함)");
  await page.locator("#shutter").click();
  await wait(1800);
  const state = await page.evaluate(() => window.__cb.getState());
  check(
    "이미지 로드됨 (화면 해상도)",
    state.hasImage && state.baseSize?.[0] > 100 && state.baseSize?.[1] > 100,
    JSON.stringify(state.baseSize),
  );
  check("캡처 후 창 복원됨", await app.evaluate(() => global.__cbMain.window().isVisible()));

  console.log("\n[5] 전역 단축키 경로 (quickCapture) → 렌더러 퀵 파이프라인");
  await page.evaluate(() =>
    window.__cb.setQuickSettings({ enabled: true, autoCopy: true, autoSave: false, autoTrim: false, thumbnailSec: 20 }),
  );
  await app.evaluate(() => global.__cbMain.quickCapture({ showEditor: false }));
  await wait(1200);
  check("퀵 캡처 후 썸네일 표시", await page.locator("#quick-thumb").isVisible());
  const clipboardOk = await app.evaluate(({ clipboard }) => clipboard.has("image/png"));
  check("OS 클립보드에 이미지 복사됨", clipboardOk);

  console.log("\n[6] 전역 단축키 변경 IPC");
  const setRes = await page.evaluate(() =>
    window.native.setGlobalShortcuts({ quick: "CommandOrControl+Shift+8", edit: "CommandOrControl+Shift+9" }),
  );
  check("변경 적용 응답 ok", setRes.ok === true, JSON.stringify(setRes));
  const after = await app.evaluate(({ globalShortcut }) => ({
    new8: globalShortcut.isRegistered("CommandOrControl+Shift+8"),
    old1: globalShortcut.isRegistered("CommandOrControl+Shift+1"),
  }));
  check("새 단축키 등록 + 이전 해제", after.new8 && !after.old1, JSON.stringify(after));
  const invalid = await page.evaluate(() =>
    window.native.setGlobalShortcuts({ quick: "NotAKey+", edit: "CommandOrControl+Shift+9" }),
  );
  check(
    "잘못된 accelerator 는 기본값으로 정규화",
    invalid.applied.quick === "CommandOrControl+Shift+1",
    JSON.stringify(invalid.applied),
  );

  console.log("\n[7] 닫기 = 트레이로 (앱 종료 아님)");
  await app.evaluate(() => global.__cbMain.window().close());
  await wait(600);
  const hiddenNotDead = await app.evaluate(() => {
    const w = global.__cbMain.window();
    return !w.isDestroyed() && !w.isVisible();
  });
  check("창 숨김 상태로 유지", hiddenNotDead);
  check("트레이 생성 시도 결과", await app.evaluate(() => typeof global.__cbMain.hasTray() === "boolean"));
  const trayOk = await app.evaluate(() => global.__cbMain.hasTray());
  console.log(`  ℹ️ 트레이 실제 생성: ${trayOk} (컨테이너 데스크톱 환경에 따라 다름)`);

  if (failures === 0) console.log("\n🎉 데스크톱 e2e 전체 통과");
  else console.error(`\n❌ 실패 ${failures}건`);
} catch (err) {
  failures++;
  console.error("e2e-desktop 실행 오류:", err);
} finally {
  await app?.close().catch(() => {});
}
process.exit(failures === 0 ? 0 : 1);
