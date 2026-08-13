// ════════════════════════════════════════════════════════════
// PRELOAD — cầu nối AN TOÀN giữa main process (Node/Electron) và
// trang web (index.html, chạy trong renderer với contextIsolation:true,
// nodeIntegration:false — không có quyền Node trực tiếp).
//
// Chỉ expose đúng 4 hàm cần cho TV Mode / Full Screen, KHÔNG expose
// toàn bộ ipcRenderer hay bất kỳ API Node nào khác ra window — giữ đúng
// nguyên tắc an toàn của contextIsolation.
// ════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tvNative', {
  // Đánh dấu để index.html biết đang chạy trong app .exe (Electron),
  // không phải trình duyệt thường — để chọn đúng cơ chế Full Screen
  // (native qua main process) thay vì HTML Fullscreen API (dễ bị mất
  // khi reload/navigate).
  isElectron: true,

  // Lấy trạng thái TV Mode/Full Screen đã lưu (đọc từ main process,
  // KHÔNG phải localStorage của renderer) — dùng lúc khởi động app để
  // renderer tự khôi phục đúng giao diện Điều hành SX.
  getState: () => ipcRenderer.invoke('tv-get-state'),

  // Báo cho main process biết trạng thái TV Mode/Full Screen mong muốn
  // (gọi mỗi khi người dùng bấm nút TV Mode/Thoát TV). Main process sẽ
  // là nơi DUY NHẤT thực sự gọi BrowserWindow.setFullScreen() ở tầng
  // cửa sổ Windows thật, và lưu lại vào file trên đĩa để khôi phục sau
  // khi tắt/mở lại app.
  setState: (tvMode, tvFullscreen) => ipcRenderer.send('tv-set-state', { tvMode, tvFullscreen }),

  // Lắng nghe khi main process TỰ đổi trạng thái Full Screen (ví dụ
  // main process vừa khôi phục Full Screen lúc khởi động, hoặc người
  // dùng nhấn Esc/F11 ở tầng hệ điều hành khiến cửa sổ thoát Full
  // Screen mà không qua nút bấm trong app) — để renderer đồng bộ lại
  // đúng label nút bấm + class giao diện, không bị lệch trạng thái.
  onStateSync: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('tv-state-sync', listener);
    return () => ipcRenderer.removeListener('tv-state-sync', listener);
  },
});
