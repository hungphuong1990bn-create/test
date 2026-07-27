# Quản Lý SX Đông Phương — bản Android (.apk)

Giống cách làm với bản desktop: đây là một "vỏ" (dùng Capacitor thay vì
Electron) mở app web của bạn
(`https://hungphuong1990bn-create.github.io/test/`) trong một WebView toàn
màn hình trên điện thoại, có icon riêng, mở từ màn hình chính như app
thật.

File `.apk` build ra là **bản debug**, được tự động ký bằng key debug mặc
định của Android — cài trực tiếp lên điện thoại (bật "Cài từ nguồn không
xác định") là dùng được ngay, không cần Google Play, không cần tài khoản
Google Developer.

## Vì sao không cần build lại .apk mỗi khi sửa code?

Y hệt bản desktop: `index.html` vẫn nằm trên GitHub Pages. `capacitor.config.json`
trong này chỉ trỏ tới URL đó (`server.url`). Sửa `index.html` ở gốc repo và
push — app Android tự thấy bản mới ngay khi mở lên, không cần cài lại.

Bạn **chỉ cần build lại .apk** khi đổi chính cái vỏ này (tên app, icon,
màu splash screen, hay đổi URL app trỏ tới).

## Bước 1 — Đưa thư mục này vào repo GitHub

Copy thư mục `android-app/` vào **gốc repo** (ngang hàng với `index.html`
và `electron-app/`), sao cho cấu trúc trông như:

```
your-repo/
├── index.html
├── electron-app/
├── android-app/
│   ├── android/            (project Android gốc, do Capacitor tạo sẵn)
│   ├── www/
│   ├── resources/          (icon.png, splash.png — nguồn để tạo lại icon)
│   ├── capacitor.config.json
│   ├── package.json
│   └── release-android.yml  ⚠️ file này KHÔNG để ở đây
└── .github/
    └── workflows/
        ├── release-desktop.yml
        └── release-android.yml  ⚠️ PHẢI copy vào đây
```

**Quan trọng — giống lần trước với bản desktop:** file `release-android.yml`
đang nằm ở gốc thư mục `android-app/` (mình để riêng ra ngoài cho dễ thấy),
bạn phải **copy nó vào `.github/workflows/release-android.yml` ở gốc
repo** (cùng chỗ với `release-desktop.yml` đã có), KHÔNG để trong
`android-app/`.

```bash
git add android-app
git commit -m "Add Android app (Capacitor wrapper)"
git push
```

Rồi vào GitHub, tạo file `.github/workflows/release-android.yml`, dán nội
dung từ `android-app/release-android.yml` vào, commit.

## Bước 2 — Build lần đầu

Quyền "Read and write permissions" cho Actions bạn đã bật từ lúc làm bản
desktop rồi, không cần bật lại.

Tạo release mới để kích hoạt build (giống hệt cách làm bản desktop, chỉ
đổi tên tag):

1. Vào **Releases → Create a new release**
2. Tag: `android-v1.0.0`
3. Target: `main`
4. Publish release

Vào tab **Actions**, đợi workflow "Build & Release Android APK" chạy xong
(khoảng 5–8 phút, lần đầu hơi lâu vì phải tải Android SDK/Gradle). Xong,
vào lại **Releases → android-v1.0.0 → Assets**, tải file
`QuanLySXDongPhuong.apk` về điện thoại và cài (nhớ bật "Cho phép cài từ
nguồn không xác định" trong Cài đặt Android nếu máy hỏi).

## Từ đó về sau

- **Sửa `index.html`/nghiệp vụ:** push như bình thường ở gốc repo — không
  đụng gì `android-app/`. App tự thấy bản mới.
- **Muốn build .apk mới** (đổi icon/tên/URL...): sửa file trong
  `android-app/`, tạo tag mới (`android-v1.0.1`...) như Bước 2.

  App sẽ **tự kiểm tra và nhắc người dùng** (banner "📲 Có bản app mới X.X.X!
  Tải về ngay") mỗi khi mở app / quay lại app (tối đa 1 lần/4 tiếng) — xem
  mục "Cơ chế tự nhắc cập nhật app" bên dưới. Người dùng bấm "Tải về ngay"
  sẽ mở trình duyệt tới đúng file `.apk` mới trên GitHub Releases để tải và
  cài đè lên (Android cho cài đè nếu cùng `appId`, dữ liệu không bị mất).
  Android không cho tự cài ngầm như Play Store, nên bước cài đặt cuối vẫn
  cần người dùng tự bấm "Cài đặt" sau khi tải xong.

## Cơ chế tự nhắc cập nhật app

Vì file `.apk` không tự cập nhật như PWA, mình đã thêm một đoạn code vào
`index.html` (ở gốc repo, không phải trong `android-app/`) chỉ chạy khi app
mở bên trong vỏ Android:

1. Mỗi lần mở app / quay lại app (tối đa 1 lần/4 tiếng), app đọc phiên bản
   thật của chính nó (`Capacitor App.getInfo()`).
2. So sánh với tag `android-v*` mới nhất trên GitHub Releases (gọi thẳng
   GitHub API công khai, không cần token).
3. Nếu có bản mới hơn, hiện banner giống hệt phong cách banner "Có bản cập
   nhật" sẵn có của bạn, kèm nút "Tải về ngay" — bấm vào sẽ mở trình duyệt
   tới đúng file `.apk` của bản release đó.

Cơ chế này hoạt động được là nhờ bước **"Set app version from tag"** mới
thêm trong `release-android.yml`: mỗi lần build từ tag `android-v1.0.2`,
workflow tự ghi `versionName "1.0.2"` vào `android/app/build.gradle` trước
khi build — nên app luôn tự biết chính xác phiên bản thật của mình, không
cần bạn sửa tay.

**Bạn không cần làm gì thêm** — chỉ cần nhớ tăng số trong tag mỗi lần tạo
release mới (`android-v1.0.1`, `android-v1.0.2`...) như hướng dẫn ở Bước 2,
mọi thứ còn lại tự động.

## Muốn đổi icon/splash?

Thay 2 file `resources/icon.png` (vuông, tối thiểu 1024×1024) và
`resources/splash.png`, rồi chạy lại (trên máy có Node.js):
```bash
cd android-app
npx capacitor-assets generate --android --iconBackgroundColor '#1e3a8a' --splashBackgroundColor '#1e3a8a'
```
rồi commit thư mục `android/app/src/main/res/` đã đổi, tạo tag mới.

## Sau này muốn làm bản iOS

Apple bắt buộc phải có tài khoản **Apple Developer Program (99 USD/năm)**
để ký ứng dụng thì mới cài lên iPhone thật được (không có cách né được,
kể cả build trên GitHub Actions). Khi nào bạn có tài khoản đó, nói mình,
mình sẽ thêm workflow build iOS (`.ipa`) tương tự — quy trình build thì
GitHub Actions free (dùng runner macOS), chỉ cần bạn cung cấp certificate
+ provisioning profile của tài khoản Apple làm secrets.
