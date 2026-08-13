// ════════════════════════════════════════════════════════════
// ELECTRON MAIN PROCESS — "vỏ" desktop app cho web app quản lý SX.
//
// App KHÔNG chứa index.html/logic nghiệp vụ bên trong .exe. Nó chỉ mở
// một cửa sổ trỏ tới URL GitHub Pages đang host app thật (APP_URL bên
// dưới). Vì vậy:
//   - Mỗi khi bạn sửa code và push lên GitHub (Pages tự deploy lại),
//     người dùng mở app lên là thấy bản mới NGAY — không cần cài lại
//     Setup.exe, không cần rebuild gì cả.
//   - Cơ chế network-first + version.json bạn đã có sẵn trong
//     index.html/sw.js vẫn hoạt động y hệt như khi mở bằng trình duyệt.
//   - Setup.exe chỉ cần build lại khi bạn đổi chính CÁI VỎ này (icon,
//     tên app, kích thước cửa sổ, v.v.) — lúc đó electron-updater bên
//     dưới sẽ tự tải bản vỏ mới cho người dùng đã cài.
//
// ── TV MODE + FULL SCREEN (native, không dùng CSS/JS giả lập) ─────────
// index.html có 2 trạng thái riêng: TV MODE (bố cục "Điều hành SX") và
// FULL SCREEN (cửa sổ Windows chiếm toàn màn hình). Trước đây Full
// Screen chỉ được bật bằng document.requestFullscreen() phía renderer
// (HTML Fullscreen API) — đây là lý do gốc gây mất Full Screen sau mỗi
// lần reload/reset: Chromium LUÔN tự thoát HTML Fullscreen API mỗi khi
// trang điều hướng/tải lại, bất kể lý do gì.
//
// Từ bản này, Full Screen được điều khiển ở ĐÚNG tầng cửa sổ native
// (BrowserWindow.setFullScreen()) do chính main process này quản lý —
// một thuộc tính của CỬA SỔ HĐH, hoàn toàn độc lập với việc trang web
// bên trong có reload/navigate hay không. Trạng thái được lưu ra file
// trên đĩa (không phải localStorage, vốn thuộc renderer và có thể bị
// dọn khi clear cache) để khôi phục đúng sau khi tắt hẳn app rồi mở
// lại (kể cả sau khi electron-updater cập nhật bản vỏ mới).
// ════════════════════════════════════════════════════════════

const { app, BrowserWindow, shell, Menu, ipcMain, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// ĐỔI URL NÀY thành đúng địa chỉ GitHub Pages của bạn nếu khác.
const APP_URL = 'https://hungphuong1990bn-create.github.io/test/';

// ── TỰ KHỞI ĐỘNG CÙNG WINDOWS + TỰ VÀO TV MODE ─────────────────────────
// Cờ truyền vào khi đăng ký app với Windows (Settings ▸ Startup Apps) để
// nhận biết ĐÚNG lần khởi động này là do WINDOWS tự mở app lúc đăng nhập
// máy — chứ KHÔNG phải do người dùng tự bấm icon/Start Menu để làm việc
// bình thường. Chỉ khi nào là Windows tự mở (AUTOSTART_ARG) mới tự thêm
// ?tv=1 vào URL để trang web tự khoá vào "Điều hành SX" + TV Mode + Full
// Screen ngay (cơ chế khoá TV có sẵn trong index.html, xem hàm
// dhTvLocked()/goTab()) — không đụng gì tới hành vi mở app thủ công hiện
// có, đúng yêu cầu không ảnh hưởng các chức năng khác. Đây cũng chính là
// cơ chế "chỉ dùng 1 màn hình TV": khi Full Screen được bật, cửa sổ luôn
// mở trên MỘT màn hình duy nhất (màn đã lưu lần trước, hoặc màn chính nếu
// chưa từng lưu/màn cũ không còn) — xem resolveTargetDisplay() bên dưới.
const AUTOSTART_ARG = '--auto-launch';

function getAutoStartState() {
  try {
    const s = app.getLoginItemSettings({ args: [AUTOSTART_ARG] });
    return { openAtLogin: !!s.openAtLogin };
  } catch (e) {
    return { openAtLogin: false };
  }
}

function setAutoStartState(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      // Truyền lại đúng cờ AUTOSTART_ARG để lần sau Windows tự mở app,
      // main process nhận ra được (wasOpenedAtLogin/process.argv) mà tự
      // vào TV Mode + Full Screen ngay, không cần thao tác gì thêm.
      args: [AUTOSTART_ARG],
    });
  } catch (e) {
    // Một số môi trường (vd chạy portable, chưa cài qua Setup.exe) không hỗ
    // trợ đăng ký login item — bỏ qua, không chặn app khởi động bình thường.
  }
  return getAutoStartState();
}

function wasLaunchedByWindowsStartup() {
  try {
    const s = app.getLoginItemSettings({ args: [AUTOSTART_ARG] });
    return !!s.wasOpenedAtLogin || process.argv.includes(AUTOSTART_ARG);
  } catch (e) {
    return process.argv.includes(AUTOSTART_ARG);
  }
}

// URL thực sự sẽ nạp cho cửa sổ — chỉ thêm ?tv=1 khi CHÍNH Windows tự mở
// app lúc khởi động máy (đã bật "Tự khởi động cùng Windows" trong Cài đặt).
function buildLoadUrl() {
  return wasLaunchedByWindowsStartup() ? APP_URL + '?tv=1' : APP_URL;
}

// Đặt true nếu muốn Full Screen kiểu KIOSK THẬT (ẩn hẳn taskbar Windows,
// chặn Alt+Tab/Esc thoát ra ngoài) — phù hợp nếu máy chỉ dùng riêng để
// chạy TV 24/7, không ai cần thao tác Windows khác trên máy đó. Để
// false (mặc định) thì Full Screen vẫn chiếm toàn màn hình nhưng người
// dùng vẫn thoát ra ngoài được bằng Alt+Tab khi cần (ví dụ 1 PC vừa
// dùng để bấm "Điều hành SX" vừa thỉnh thoảng làm việc khác).
const TV_USE_KIOSK = false;

let mainWindow;

// ── Lưu/đọc trạng thái TV Mode + Full Screen ra file trên đĩa ─────────
// Dùng app.getPath('userData') (thư mục riêng của app, KHÔNG bị xoá khi
// clear cache trình duyệt bên trong webContents) — sống sót qua mọi lần
// auto reset/reload/update bản vỏ.
const TV_STATE_FILE = () => path.join(app.getPath('userData'), 'tv-state.json');

function loadTvState() {
  try {
    const raw = fs.readFileSync(TV_STATE_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      tvMode: !!parsed.tvMode,
      tvFullscreen: !!parsed.tvFullscreen,
      displayId: typeof parsed.displayId === 'number' ? parsed.displayId : null,
    };
  } catch (e) {
    // Chưa có file (lần đầu mở app) hoặc file lỗi → coi như chưa bật TV Mode.
    return { tvMode: false, tvFullscreen: false, displayId: null };
  }
}

function saveTvState(state) {
  try {
    fs.mkdirSync(path.dirname(TV_STATE_FILE()), { recursive: true });
    fs.writeFileSync(TV_STATE_FILE(), JSON.stringify(state), 'utf8');
  } catch (e) {
    // Không chặn app nếu lỡ ghi file thất bại (ví dụ đĩa đầy) — TV Mode
    // vẫn hoạt động ở phiên hiện tại, chỉ là lần khởi động sau có thể
    // không khôi phục đúng.
  }
}

let tvState = loadTvState();

// Tìm đúng màn hình đã lưu (theo displayId) trong số các màn hình đang
// cắm — nếu màn đó không còn (TV bị rút cáp, đổi cổng...) thì rơi về
// màn hình chính (primary) thay vì lỗi/crash.
function resolveTargetDisplay() {
  const displays = screen.getAllDisplays();
  const saved = tvState.displayId != null ? displays.find(d => d.id === tvState.displayId) : null;
  return saved || screen.getPrimaryDisplay();
}

function createWindow() {
  const shouldStartFullscreen = tvState.tvMode && tvState.tvFullscreen;
  const targetDisplay = shouldStartFullscreen ? resolveTargetDisplay() : null;

  mainWindow = new BrowserWindow({
    // Nếu phiên trước đang TV Mode + Full Screen: mở cửa sổ NGAY trên
    // đúng màn hình đã lưu và Full Screen/kiosk từ đầu — không tạo cửa
    // sổ windowed rồi mới chuyển (tránh nhấp nháy/sai kích thước theo
    // đúng yêu cầu #4/#11).
    x: targetDisplay ? targetDisplay.bounds.x : undefined,
    y: targetDisplay ? targetDisplay.bounds.y : undefined,
    width: targetDisplay ? targetDisplay.bounds.width : 1280,
    height: targetDisplay ? targetDisplay.bounds.height : 800,
    fullscreen: shouldStartFullscreen && !TV_USE_KIOSK,
    kiosk: shouldStartFullscreen && TV_USE_KIOSK,
    show: true,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.png'),
    title: 'Quản Lý SX — Đông Phương',
    backgroundColor: '#1e3a8a',
    autoHideMenuBar: true, // ẩn thanh menu mặc định cho gọn
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  const loadUrl = buildLoadUrl();
  mainWindow.loadURL(loadUrl);

  // Mở link ngoài (nếu có) bằng trình duyệt mặc định thay vì trong app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Nếu mất mạng / lỗi load, tự thử lại sau vài giây (giữ nguyên đúng URL
  // — kể cả ?tv=1 nếu lần mở này là do Windows tự khởi động — để không bị
  // "rơi" về giao diện thường sau khi mạng có lại).
  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(loadUrl);
      }
    }, 3000);
  });

  // ── LƯỚI AN TOÀN: sau MỖI lần trang tải xong (reload thủ công qua
  // safeReload()/clearCacheAndReload() trong index.html, retry sau mất
  // mạng ở trên, hay Service Worker/version.json phát hiện bản mới rồi
  // renderer tự location.reload()) — đảm bảo cửa sổ vẫn đúng trạng thái
  // Full Screen đã lưu. Bình thường setFullScreen ở main process không
  // hề bị ảnh hưởng bởi việc trang bên trong reload (khác hẳn HTML
  // Fullscreen API), nhưng vẫn re-assert ở đây để chống mọi trường hợp
  // hiếm (ví dụ cửa sổ vừa mất focus đúng lúc trang tải lại).
  mainWindow.webContents.on('did-finish-load', () => {
    if (tvState.tvMode && tvState.tvFullscreen && mainWindow && !mainWindow.isDestroyed()) {
      if (TV_USE_KIOSK) {
        if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
      } else if (!mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(true);
      }
    }
    // Đồng bộ lại state cho renderer biết (vd sau khi main process vừa
    // tự khôi phục Full Screen ở trên) để nút bấm/giao diện TV Mode
    // trong index.html hiển thị đúng ngay từ đầu, không cần đợi người
    // dùng bấm lại.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tv-state-sync', tvState);
    }
  });

  // Bắt sự kiện Full Screen bị thoát/tắt ở TẦNG HĐH mà KHÔNG qua nút bấm
  // trong app (ví dụ người dùng chủ động nhấn Esc/F11, hoặc double-click
  // title bar) — lưu lại đúng trạng thái mới, KHÔNG tự ép bật lại (đúng
  // yêu cầu TEST 6: đã tắt thủ công thì lần sau không ép Full Screen).
  mainWindow.on('leave-full-screen', () => {
    if (tvState.tvFullscreen) {
      tvState = { ...tvState, tvFullscreen: false };
      saveTvState(tvState);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tv-state-sync', tvState);
      }
    }
  });
  mainWindow.on('enter-full-screen', () => {
    if (!tvState.tvFullscreen) {
      tvState = { ...tvState, tvFullscreen: true };
      saveTvState(tvState);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tv-state-sync', tvState);
      }
    }
  });
}

// ── IPC: renderer (index.html qua preload.js) gọi lên để đọc/ghi trạng
// thái TV Mode + Full Screen thật ở tầng cửa sổ native. ─────────────────
ipcMain.handle('tv-get-state', () => tvState);

// ── IPC: renderer đọc/ghi tuỳ chọn "Tự khởi động cùng Windows" (mục Cài
// đặt trong index.html) — main process là nơi DUY NHẤT thực sự gọi
// app.setLoginItemSettings() để đăng ký/gỡ đăng ký với Windows. ─────────
ipcMain.handle('app-get-autostart', () => getAutoStartState());
ipcMain.handle('app-set-autostart', (event, enabled) => setAutoStartState(enabled));

ipcMain.on('tv-set-state', (event, payload) => {
  const tvMode = !!(payload && payload.tvMode);
  const tvFullscreen = !!(payload && payload.tvFullscreen);

  // Lưu luôn màn hình hiện tại của cửa sổ khi bật TV Mode + Full Screen,
  // để nếu máy có PC + TV (multi-monitor) thì lần sau khởi động lại mở
  // đúng lại màn TV, không bị nhảy về màn chính.
  let displayId = tvState.displayId;
  if (tvFullscreen && mainWindow && !mainWindow.isDestroyed()) {
    try {
      displayId = screen.getDisplayMatching(mainWindow.getBounds()).id;
    } catch (e) { /* giữ nguyên displayId cũ nếu lỗi */ }
  }

  tvState = { tvMode, tvFullscreen, displayId };
  saveTvState(tvState);

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (TV_USE_KIOSK) {
      mainWindow.setKiosk(tvFullscreen);
    } else {
      mainWindow.setFullScreen(tvFullscreen);
    }
  }
});

app.whenReady().then(() => {
  createWindow();

  // Kiểm tra bản vỏ mới trên GitHub Releases mỗi khi mở app,
  // và cứ mỗi 2 tiếng trong lúc app đang chạy.
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 2 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
