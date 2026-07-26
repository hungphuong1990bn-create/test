# Quản Lý SX Đông Phương — bản Desktop (Setup.exe)

Đây là một "vỏ" Electron mở app web của bạn (đang chạy ở
`https://hungphuong1990bn-create.github.io/test/`) trong một cửa sổ desktop
riêng, giống như một trình duyệt chuyên dụng cho app này — có icon riêng,
mở từ Start Menu / Desktop, không có thanh địa chỉ.

## Vì sao không cần build lại .exe mỗi khi sửa code?

App thật (`index.html`, dữ liệu Firebase...) vẫn nằm trên GitHub Pages như
cũ. Setup.exe chỉ mở URL đó lên. Bạn đã có sẵn cơ chế network-first +
`version.json` trong `index.html`/`sw.js` — nên mỗi lần bạn sửa code và
push, GitHub Pages tự deploy bản mới, và app desktop **tự động thấy bản mới
ngay khi mở lên** (hoặc tự reload nếu bạn đã code phần banner "có bản mới").

Bạn **chỉ cần build lại Setup.exe** khi đổi chính cái vỏ Electron này (tên
app, icon, kích thước cửa sổ mặc định...) — những thứ nằm trong thư mục
`electron-app/` chứ không phải trong `index.html`.

## Bước 1 — Đưa thư mục này vào repo GitHub của bạn

Copy nguyên thư mục `electron-app/` (bao gồm cả `.github/workflows/` bên
trong nó) vào **gốc repo GitHub** đang chứa `index.html` của bạn, sao cho
cấu trúc trông như:

```
your-repo/
├── index.html
├── manifest.json
├── sw.js
├── ...
└── electron-app/
    ├── main.js
    ├── package.json
    ├── build/
    │   ├── icon.ico
    │   └── icon.png
    └── .github/
        └── workflows/
            └── release-desktop.yml
```

**Quan trọng:** di chuyển file `release-desktop.yml` ra đúng vị trí
`.github/workflows/release-desktop.yml` ở **gốc repo** (GitHub Actions chỉ
đọc workflow từ đó, không đọc từ trong thư mục con). Nếu repo của bạn đã có
sẵn thư mục `.github/workflows/`, chỉ cần thêm file này vào đó.

```bash
git add electron-app .github/workflows/release-desktop.yml
git commit -m "Add desktop app (Electron wrapper)"
git push
```

## Bước 2 — Kích hoạt quyền cho GitHub Actions tạo Release

Vào repo trên GitHub → **Settings → Actions → General** → mục "Workflow
permissions" → chọn **"Read and write permissions"** → Save. (Bước này chỉ
cần làm 1 lần.)

## Bước 3 — Build Setup.exe lần đầu

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

Vào tab **Actions** trên GitHub, bạn sẽ thấy workflow "Build & Release
Desktop App (Windows)" đang chạy (mất khoảng 3–5 phút). Khi xong, vào tab
**Releases** của repo, bạn sẽ thấy bản release `desktop-v1.0.0` kèm file
`Quan Ly SX Dong Phuong Setup 1.0.0.exe` — tải file này về cài trên máy
tính (hoặc gửi cho đồng nghiệp cài).

## Bước 4 — Từ nay về sau

- **Sửa `index.html`/nghiệp vụ:** chỉ cần `git push` như bình thường. Không
  cần đụng gì tới `electron-app/`. App desktop tự cập nhật nội dung.
- **Muốn build Setup.exe mới** (đổi icon, tên, hoặc muốn build thủ công):
  tăng số `version` trong `electron-app/package.json`, rồi:
  ```bash
  git tag desktop-v1.0.1
  git push origin desktop-v1.0.1
  ```
  Các máy đã cài app sẽ tự kiểm tra và tải bản vỏ mới (nhờ
  `electron-updater` trong `main.js`), không cần cài lại thủ công.

## Chạy thử trên máy Windows trước khi build (tuỳ chọn)

Nếu bạn có máy Windows và đã cài Node.js:

```bash
cd electron-app
npm install
npm start
```
