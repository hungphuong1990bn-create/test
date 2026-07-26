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
// ════════════════════════════════════════════════════════════

const { app, BrowserWindow, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// ĐỔI URL NÀY thành đúng địa chỉ GitHub Pages của bạn nếu khác.
const APP_URL = 'https://hungphuong1990bn-create.github.io/test/';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.png'),
    title: 'Quản Lý SX — Đông Phương',
    backgroundColor: '#1e3a8a',
    autoHideMenuBar: true, // ẩn thanh menu mặc định cho gọn
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(APP_URL);

  // Mở link ngoài (nếu có) bằng trình duyệt mặc định thay vì trong app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Nếu mất mạng / lỗi load, tự thử lại sau vài giây.
  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(APP_URL);
      }
    }, 3000);
  });
}

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
