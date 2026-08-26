/**
 * Capture Beauty 데스크톱 래퍼 (Electron)
 *
 * 웹앱(dist/)을 렌더러로 재사용하면서, 웹에서 불가능한 세 가지를 더한다:
 *  - 전역 단축키: 앱이 백그라운드/트레이에 있어도 즉시 캡처
 *  - 트레이 아이콘: 상주형 진입점 (빠른 캡처 / 캡처 후 편집 / 창 열기)
 *  - 선택창 없는 캡처: desktopCapturer 로 주 화면을 바로 뜨고,
 *    렌더러의 getDisplayMedia 도 자동 승인 → 연속 캡처가 권한 UI 없이 동작
 *
 * 실행: npm run build && npm run desktop
 */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  clipboard,
  ClipboardItem,
  nativeImage,
  Notification,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const {
  DEFAULT_GLOBAL_SHORTCUTS,
  isValidAccelerator,
  normalizeGlobalShortcuts,
} = require("./config.cjs");

app.setName("Capture Beauty");

// 테스트/포터블 실행용: 설정 저장 위치 오버라이드
if (process.env.CAPTURE_BEAUTY_USER_DATA) {
  app.setPath("userData", process.env.CAPTURE_BEAUTY_USER_DATA);
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
let shortcuts = { ...DEFAULT_GLOBAL_SHORTCUTS };

const shortcutsFile = () => path.join(app.getPath("userData"), "global-shortcuts.json");

function loadShortcuts() {
  try {
    shortcuts = normalizeGlobalShortcuts(JSON.parse(fs.readFileSync(shortcutsFile(), "utf8")));
  } catch {
    shortcuts = { ...DEFAULT_GLOBAL_SHORTCUTS };
  }
}

function saveShortcuts() {
  try {
    fs.writeFileSync(shortcutsFile(), JSON.stringify(shortcuts, null, 2));
  } catch {
    /* 저장 실패는 치명적이지 않음 */
  }
}

/* ---------- 화면 캡처 (선택창 없음) ---------- */

async function captureScreenDataUrl() {
  const display = screen.getPrimaryDisplay();
  const size = {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor),
  };
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: size });
  const source =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error("화면을 캡처하지 못했습니다.");
  }
  return source.thumbnail.toDataURL();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 자기 자신이 찍히지 않도록 창을 잠시 숨기고 캡처한다 (렌더러 개시용 — 이벤트 미발송) */
async function captureHidingWindow() {
  const wasVisible = mainWindow?.isVisible() ?? false;
  if (wasVisible) {
    mainWindow.hide();
    await sleep(280); // 컴포지터가 창을 지울 시간
  }
  try {
    return await captureScreenDataUrl();
  } finally {
    if (wasVisible) {
      mainWindow?.show();
      mainWindow?.focus();
    }
  }
}

/** 전역 단축키/트레이 캡처: 촬영 후 렌더러에 결과를 보내 퀵 동작을 돌린다 */
async function quickCapture({ showEditor }) {
  const dataUrl = await captureHidingWindow();
  if (showEditor) {
    mainWindow?.show();
    mainWindow?.focus();
  }
  mainWindow?.webContents.send("native:captured", { dataUrl, openEditor: showEditor });
  if (!showEditor) {
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: "Capture Beauty",
          body: "캡처 완료 — 퀵 동작이 실행되었습니다.",
        }).show();
      }
    } catch {
      /* 알림 불가 환경 무시 */
    }
  }
  return dataUrl;
}

/* ---------- 전역 단축키 ---------- */

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  const failed = [];
  const bind = (accelerator, handler) => {
    if (!isValidAccelerator(accelerator)) {
      failed.push(accelerator);
      return;
    }
    try {
      if (!globalShortcut.register(accelerator, handler)) failed.push(accelerator);
    } catch {
      failed.push(accelerator);
    }
  };
  bind(shortcuts.quick, () => void quickCapture({ showEditor: false }).catch(() => {}));
  bind(shortcuts.edit, () => void quickCapture({ showEditor: true }).catch(() => {}));
  return failed;
}

/* ---------- 트레이 ---------- */

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png"));
    tray = new Tray(icon.resize({ width: 20, height: 20 }));
    tray.setToolTip("Capture Beauty");
    const menu = Menu.buildFromTemplate([
      { label: `📸 빠른 캡처 (${shortcuts.quick})`, click: () => void quickCapture({ showEditor: false }).catch(() => {}) },
      { label: `✏️ 캡처 후 편집 (${shortcuts.edit})`, click: () => void quickCapture({ showEditor: true }).catch(() => {}) },
      { type: "separator" },
      { label: "창 열기", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { label: "창 숨기기", click: () => mainWindow?.hide() },
      { type: "separator" },
      { label: "종료", click: () => { isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => {
      if (mainWindow?.isVisible()) mainWindow.hide();
      else { mainWindow?.show(); mainWindow?.focus(); }
    });
  } catch {
    tray = null; // 트레이를 지원하지 않는 데스크톱 환경 — 전역 단축키만으로 동작
  }
}

function refreshTrayMenu() {
  if (tray) {
    tray.destroy();
    tray = null;
    createTray();
  }
}

/* ---------- 창 ---------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    show: false,
    backgroundColor: "#101017",
    icon: path.join(__dirname, "assets", "tray.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 렌더러의 getDisplayMedia 를 주 화면으로 자동 승인 (선택창 제거)
  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ["screen"] })
        .then((sources) => callback(sources.length ? { video: sources[0] } : undefined))
        .catch(() => callback(undefined));
    },
    { useSystemPicker: false },
  );

  const devUrl = process.env.CAPTURE_BEAUTY_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    const indexHtml = path.join(__dirname, "..", "dist", "index.html");
    if (fs.existsSync(indexHtml)) {
      void mainWindow.loadFile(indexHtml);
    } else {
      void mainWindow.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(
            "<body style='background:#101017;color:#e8e8ef;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh'>" +
              "<div><h2>빌드가 필요합니다</h2><p><code>npm run build</code> 실행 후 다시 시작하세요.</p></div></body>",
          ),
      );
    }
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // 닫기 = 트레이로 (진짜 종료는 트레이 메뉴/Cmd+Q)
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

/* ---------- IPC ---------- */

function setupIpc() {
  ipcMain.handle("native:capture-now", () => captureHidingWindow());
  ipcMain.handle("native:copy-image", async (_e, dataUrl) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
      throw new Error("잘못된 이미지 데이터입니다.");
    }
    const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    const blob = new Blob([buffer], { type: "image/png" });
    await clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  ipcMain.handle("native:get-shortcuts", () => ({ ...shortcuts }));
  ipcMain.handle("native:set-shortcuts", (_e, raw) => {
    const next = normalizeGlobalShortcuts(raw);
    shortcuts = next;
    saveShortcuts();
    const failed = registerGlobalShortcuts();
    refreshTrayMenu();
    return { ok: failed.length === 0, failed, applied: { ...shortcuts } };
  });
  ipcMain.on("native:hide", () => mainWindow?.hide());
  ipcMain.on("native:set-fullscreen", (_e, flag) => mainWindow?.setFullScreen(!!flag));
}

/* ---------- 라이프사이클 ---------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    loadShortcuts();
    setupIpc();
    createWindow();
    createTray();
    const failed = registerGlobalShortcuts();
    if (failed.length) {
      console.warn("등록 실패한 전역 단축키:", failed.join(", "));
    }
    // e2e 테스트 훅
    global.__cbMain = {
      quickCapture,
      captureHidingWindow,
      captureScreenDataUrl,
      getShortcuts: () => ({ ...shortcuts }),
      hasTray: () => tray !== null,
      window: () => mainWindow,
    };
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("activate", () => {
    mainWindow?.show();
  });

  // 트레이 상주 앱: 창이 모두 닫혀도 유지
  app.on("window-all-closed", () => {
    /* keep running */
  });
}
