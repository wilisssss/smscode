# SMSCode Desktop

Klien desktop pribadi untuk [SMSCode](https://smscode.gg) — beli nomor virtual dan terima kode OTP/SMS langsung di Linux (dioptimalkan untuk **Arch Linux**, terpasang sebagai paket `.pkg.tar.zst` lewat `pacman`).

Dibangun dengan **Rust + Tauri v2** (backend, jaringan, rahasia) dan **React + TypeScript + Tailwind** (UI). Token API disimpan di **Secret Service** (gnome-keyring / KWallet) — tidak pernah di file plaintext, localStorage, atau log.

## Fitur

- **Beranda = order cepat**: 10 layanan populer (WhatsApp, Telegram, Google, …) satu klik dari aplikasi terbuka.
- **Alur order bertahap**: Layanan → Negara → Operator (termasuk opsi *Any*) → Daftar harga (stok & harga real-time, termurah di atas) → Konfirmasi → Order.
- **Idempotency-safe**: pembuatan order/reactivate memakai `Idempotency-Key`; retry otomatis memakai key yang sama — **tidak ada risiko dobel debit**.
- **Order aktif live**: daftar diperbarui tiap 4 detik; **OTP tampil besar**, countdown kedaluwarsa, tombol aksi:
  - **Selesai** (finish — refund ditutup setelah SMS masuk),
  - **Batalkan** (otomatis disabled ±2 menit pertama / setelah OTP masuk, sesuai aturan server),
  - **Kirim Ulang SMS** (otomatis disabled bila `resend_mode = auto`),
- **Notifikasi desktop + bunyi** (freedesktop sound, dengan chime Web Audio sebagai cadangan) untuk **OTP masuk, Order dibuat, Selesai, Batalkan** — masing-masing preferensinya bisa dimatikan di Pengaturan + **auto-salin OTP ke clipboard**.
- **Riwayat SMS lokal** — setiap OTP/SMS yang teramati (termasuk SMS tanpa kode, dihitung via `sms_revision`) tercatat per order; tersimpan hanya di perangkat ini.
- **Template Favorit** — pin kombinasi layanan+negara+operator+tier ke beranda; klik sekali → langsung ke dialog konfirmasi dengan harga **fresh**.
- **Order Baru dari kartu aktif** — nomor ditolak/diblokir platform? Klik **Order Baru** di kartu order aktif untuk sewa nomor baru dengan tier yang sama — tanpa menunggu 2 menit untuk cancel.
- **Command palette (Ctrl+K)**, **shortcut Ctrl+1..4**, chip **Order Terakhir** di beranda (order ulang 1 klik).
- **Kartu statistik Riwayat** (total keluar, selesai/gagal, success rate) + **filter rentang tanggal**.
- **Panel "Gagal" dari `failed_reason` provider** di kartu Order Aktif; **toast saat order kedaluwarsa** (refund).
- **Privasi**: toggle detail di notifikasi, sensor nomor di UI, **jam tenang** untuk bunyi.
- **Backup/Import JSON** (preferensi + template + riwayat; token tidak ikut) + **Reset semua pengaturan**.
- **Log file** `~/.local/share/smscode-desktop/logs/app.log` untuk diagnosis.
- **Polling di Rust** — data order diperbarui tiap 4 detik oleh background task Rust (anti-throttle webview) dan di-push ke UI via event; tidak ada timer JS.
- **Tutup jendela = keluar** dari aplikasi (tidak ada mode tray; keputusan eksplisit produk).
- **Riwayat** 50 order terakhir: filter status, cari, **salin CSV**, **Pesan Lagi** (sewa nomor baru dengan produk yang sama), dan **Reactivate** (aktifkan kembali nomor yang sama — dengan preview biaya terlebih dahulu, tanpa potong saldo sampai dikonfirmasi).
- **Isi saldo 1 klik**: tombol membuka dashboard SMSCode di browser (kredensial pembayaran tidak pernah masuk aplikasi ini).
- **Guard saldo**: order otomatis disabled bila saldo < harga tier (ditolak sebelum hit server).
- **Tema** Gelap / Terang / Sistem · tanpa telemetry · tanpa auto-update (pacman yang update).

## Instalasi (paket Arch)

Unduh/rilis `smscode-desktop-<versi>-1-x86_64.pkg.tar.zst`, lalu:

```bash
sudo pacman -U smscode-desktop-1.3.0-1-x86_64.pkg.tar.zst
```

Dependensi runtime: `gtk3`, `webkit2gtk-4.1`, `libsoup3` (terpasang otomatis via pacman).
**Sangat disarankan**: `gnome-keyring` (Secret Service) untuk penyimpanan token; tanpa itu aplikasi menolak menyimpan token demi keamanan.

## Penggunaan pertama

1. Buat token di **Account Settings → API** pada [dashboard SMSCode](https://smscode.gg).
2. Buka aplikasi → **Pengaturan** → tempel token → **Simpan** → **Test Koneksi** (harus menampilkan saldo).
3. Kembali ke **Order Baru** → klik layanan populer → pilih negara → operator → harga termurah → **Order**.
4. OTP masuk → muncul notifikasi; kode tersalin otomatis (jika aktif) → tempel di aplikasi tujuan → tekan **Selesai**.

## Build dari source

```bash
# Kebutuhan: rust, nodejs, npm, webkit2gtk-4.1, gtk3 (semua ada di repo resmi Arch)
sudo pacman -S --needed rust nodejs npm webkit2gtk-4.1 gtk3 base-devel

npm ci
npm run build          # tsc + vite → dist/
npm run tauri:build    # opsional: verifikasi bundle Tauri
```

### Rilis otomatis (disarankan)

```bash
./scripts/release.sh 1.0.1             # bump versi semua file + tarball + sha256 + makepkg
./scripts/release.sh 1.0.1 --install   # sama, lalu langsung `sudo pacman -U`
```

Script melakukan: sinkron versi ke `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, `PKGBUILD` (pkgrel direset ke 1) → membuat tarball source bersih → menghitung `sha256sums` → menjalankan `makepkg -c` → opsional install via pacman.

### Build manual (tanpa script)

```bash
# Buat tarball source (tanpa node_modules/target)
cd ~/Projects
tar -czf smscode-desktop-1.3.0.tar.gz \
  --exclude='smscode/node_modules' --exclude='smscode/dist' \
  --exclude='smscode/src-tauri/target' --exclude='smscode/src-tauri/gen' \
  --transform 's|^smscode|smscode-desktop-1.3.0|' smscode
mv smscode-desktop-1.3.0.tar.gz smscode/packaging/

cd smscode/packaging
sha256sum smscode-desktop-1.3.0.tar.gz   # update 'sha256sums' di PKGBUILD
makepkg -c
sudo pacman -U smscode-desktop-1.3.0-1-x86_64.pkg.tar.zst
```

Verifikasi isi paket: `pacman -Ql smscode-desktop`, lint: `namcap smscode-desktop-*.pkg.tar.zst`.

## Struktur proyek

```
src/                 # Frontend React (hanya render; tidak ada token di sini)
  lib/api.ts         #   wrapper invoke() → Rust
  pages/             #   OrderWizard (home), ActiveOrders, History, Settings
src-tauri/src/
  api/               #   Client tipis /v1 (reqwest) — 1:1 dengan operationId OpenAPI
  poller.rs          #   Polling order di Rust (4 dtk, emit `orders-updated`)
  commands.rs        #   Tauri commands
  keyring.rs         #   Token ↔ Secret Service
packaging/           #   PKGBUILD + .desktop → .pkg.tar.zst
scripts/             #   release.sh (rilis otomatis) + bump-version.sh
```

## Catatan API

Integrasi memakai **publik `/v1` (IDR)** dari [OpenAPI](https://smscode.gg/openapi.yaml). Semua money = integer Rupiah. Error ditangani berdasarkan `error.code` (HTTP status tetap per kode), bukan teks pesan. Rate limit: order create 3.000 req/60 dtk — polling UI jauh di bawah itu.

Webhook **tidak** dipakai (desktop tidak punya endpoint publik) — client melakukan polling `GET /v1/orders` tiap 4 detik.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
