# Changelog SMSCode Desktop

Semua perubahan penting dicatat di file ini. Format mengikuti semver (MAJOR.MINOR.PATCH).

## [1.4.1] - 2026-11-07

### Perbaikan
- **Salin nomor/OTP tidak berfungsi** — capability `clipboard-manager:default` ternyata tidak mengizinkan perintah apa pun; ditambahkan izin eksplisit `clipboard-manager:allow-write-text`.
- Penyalinan kini berlapis (plugin Tauri → Clipboard API → `execCommand`) dan kegagalan ditampilkan sebagai toast, bukan ditelan diam-diam.
- Auto-salin OTP memberi umpan balik sukses/gagal yang jelas.
- **Layout Android** — sidebar desktop disembunyikan di layar kecil dan diganti bottom navigation; konten tidak lagi terjepit.
- **Card Order Aktif** dirapikan untuk layar HP: status + countdown sebaris, nomor tidak terpotong, log SMS bertumpuk rapi, dan tombol aksi 2 kolom rata.
- **Font** — JetBrains Mono Nerd Font dibundel dan menjadi font utama desktop + Android.
- Statistik Riwayat tidak lagi berdesakan di HP; input pencarian Order Baru tidak otomatis membuka keyboard di Android.
- **Order Baru** — tabel harga kini hanya menampilkan Stok, Harga, dan Aksi (kolom Tier dihapus karena tidak diperlukan), padding dirapatkan agar pas di HP, dan nama layanan dihapus dari judul harga.
- **Order Aktif** — tombol salin pada riwayat SMS/OTP kini berada tepat di samping kode, bukan di bawahnya.
- **Riwayat Order** — tombol salin OTP per baris dihapus; badge status **Selesai** / **OTP Diterima** bisa diklik untuk membuka dialog daftar OTP dengan tombol salin di samping tiap kode.
- **Setelan** — seluruh kartu responsif di HP dan ada pengaturan baru **Jeda polling** (default 4 detik, rentang 2–60 detik) yang langsung berlaku tanpa restart.
- **Optimasi ukuran & memori** — font Nerd Font di-subset ke karakter Latin + simbol yang benar-benar dipakai: 4 weight turun dari ~4,1 MB menjadi ~219 KB (≈97%), sehingga APK lebih kecil dan memori font lebih hemat.
- **Optimasi GPU** — `backdrop-blur` dihapus dari sidebar dan bottom navigation yang sudah hampir opak, mengurangi beban kerja dan memori grafis tanpa perubahan tampilan berarti.

## [1.4.0] - 2026-11-05

### Fitur baru
- **Command palette (Ctrl/Cmd+K)** — navigasi halaman + pencarian layanan, `Ctrl/Cmd+1..4` pindah halaman.
- **Chip "Order Terakhir" di beranda** — order ulang 1 klik dari 5 order terakhir (tier yang sama).
- **Kartu statistik Riwayat** — total keluar (selesai), selesai/gagal, success rate dari 50 order terakhir.
- **Filter rentang tanggal di Riwayat** (from → to).
- **Panel "Gagal" dari `failed_reason` provider** di kartu Order Aktif.
- **Notifikasi kedaluwarsa** — toast saat order berubah menjadi EXPIRED (refund maskudnya).
- **Rate-limit helpers**: auto-retry 1× untuk create (transient saja, idempotencyKey sama).
- **Privasi**: toggle "Tampilkan nomor & kode di notifikasi", sensor nomor di UI (screenshot).
- **Jam tenang** — bunyi dibisukan pada rentang waktu yang diatur (tengah malam OK).
- **Backup/Import JSON** — preferensi + template + riwayat SMS lokal (token API tidak ikut).
- **Log file** `~/.local/share/smscode-desktop/logs/app.log` — diagnosis tanpa stderr.

### Perbaikan
- SMS tanpa konten terbaca kini ikut terdeteksi (sinyal `sms_revision` murni).
- FOUC gelap-terang dihapus (tema diterapkan sebelum CSS paint).
- Notifikasi "balasan HTTP 200 non-JSON" — poller retry & threshold; error permanen langsung tampil.
- CSV export beri peringatan (berisi OTP).
- Query staleTime katalog 5 menit, reuse koneksi TLS, heartbeat & "Sinkronisasi terakhir".
- Font kecil dinormalisasi di seluruh UI.
- Installer: sinkronkan `cargo fmt --check` ke CI rilis.

### Keamanan
- Peringatan pada export CSV berisi OTP; mask nomor untuk berbagi layar.

## [1.3.1] - 2026-11-04

- Fix spam notifikasi OTP saat aplikasi dibuka (baseline kosong).
- Fix zombie `canberra-gtk-play`; CPU idle 0% (animasi tak berujung dihapus).
- Poller tahan transient (retry 2×; error setelah 3 gagal berturut-turut).

## [1.3.0] - 2026-11-04

- Bunyi native freedesktop (`canberra-gtk-play`) untuk OTP/Order Baru/Selesai/Batalkan.
- Sinkron versi UI dari `package.json`.

## [1.2.0] - 2026-11-04

- Tombol **Order Baru** di kartu Order Aktif (sewa nomor baru tier yang sama, tanpa menunggu cancel 2 menit).

## [1.1.1] - 2026-11-04

- Fix baseline OTP kosong saat dibuka (spam notifikasi).

## [1.1.0] - 2026-11-04

- `scripts/release.sh` + `bump-version.sh`; polling dipindah ke Rust; Template Favorit; sound OTP; close langsung keluar (tanpa tray).

## [1.0.0] - 2026-11-04

- Rilis awal: alur order (layanan → negara → operator → harga), order aktif (Selesai/Batalkan/Kirim Ulang), riwayat + Reactivate, token di Secret Service, paket Arch `.pkg.tar.zst`.
