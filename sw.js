// ════════════════════════════════════════════════════════════
// SERVICE WORKER — chỉ hỗ trợ cài đặt/cập nhật app (PWA), KHÔNG cache
// dữ liệu nghiệp vụ (đơn hàng, chấm công...) — dữ liệu đó luôn lấy
// trực tiếp từ Firebase, không qua SW.
//
// SỬA LỖI GỐC "app chạy bản cũ dù đã deploy bản mới": bản trước dùng
// cache-first cho MỌI request (kể cả index.html/JS) — 1 khi index.html
// đã được cache lần đầu, các lần mở app sau LUÔN nhận lại đúng bản đó,
// không hề gọi mạng kiểm tra bản mới. Sửa: index.html/JS/manifest/
// version.json dùng NETWORK-FIRST (luôn thử tải bản mới nhất từ mạng,
// chỉ dùng cache khi mất mạng hẳn); cache-first CHỈ áp dụng cho tài
// nguyên tĩnh khác (ảnh, icon...) để tải nhanh, ít tốn data.
// ════════════════════════════════════════════════════════════

// Đổi số này mỗi khi deploy bản mới (hoặc để build pipeline tự thay) —
// tên cache đổi theo giúp bước 'activate' dọn sạch mọi cache cũ.
const CACHE = 'sx-thanh-cai-v2';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  // KHÔNG tự self.skipWaiting() ở đây nữa — index.html chủ động gửi
  // message SKIP_WAITING (xem listener 'message' bên dưới) đúng lúc
  // muốn kích hoạt bản mới (sau khi hiện banner báo có bản mới), tránh
  // đột ngột đổi bản/reload giữa lúc người dùng đang thao tác dở.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lệnh "kích hoạt bản mới ngay" gửi từ index.html khi phát hiện bản
// mới đã cài xong (nw.postMessage({type:'SKIP_WAITING'})) — trước đây
// KHÔNG có listener này nên lệnh gửi đi rơi vào hư không.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // không can thiệp POST/PUT lên Firebase
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // request tới Firebase/API khác origin: đi thẳng qua mạng

  const isAppShell = req.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('manifest.json')
    || url.pathname.endsWith('version.json');

  if (isAppShell) {
    // NETWORK-FIRST: luôn ưu tiên bản mới nhất từ mạng; chỉ rơi về
    // cache khi mất mạng hẳn (không fetch được).
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Tài nguyên tĩnh khác (ảnh, icon, font...): cache-first cho nhanh,
  // vẫn âm thầm cập nhật cache ngầm cho lần sau.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
