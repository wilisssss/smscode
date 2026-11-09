// Terjemahkan CommandError (branch pada `code`, bukan `message`) ke pesan
// Bahasa Indonesia yang jelas + tindakan yang disarankan.
import { isCommandError } from './api'

export function friendlyError(err: unknown): string {
  if (!isCommandError(err)) {
    return typeof err === 'string' ? err : 'Terjadi kesalahan yang tidak dikenal.'
  }
  const { code, message, retry_after } = err
  switch (code) {
    case 'NO_TOKEN':
      return 'Token API belum disimpan. Buka Pengaturan dan masukkan token Anda.'
    case 'UNAUTHORIZED':
      return 'Token ditolak server (401). Periksa kembali token di Pengaturan.'
    case 'FORBIDDEN':
      return 'Akun Anda tidak diizinkan melakukan aksi ini (403).'
    case 'NOT_FOUND':
      return 'Data tidak ditemukan (404). Mungkin sudah kedaluwarsa atau dibatalkan.'
    case 'INSUFFICIENT_BALANCE':
      return 'Saldo tidak mencukupi. Isi saldo dulu lewat dashboard SMSCode.'
    case 'NO_OFFER_AVAILABLE':
      return 'Tidak ada tier yang cocok (stok habis atau di atas batas harga).'
    case 'CANCEL_TOO_EARLY':
      return 'Order terlalu baru untuk dibatalkan. Tunggu sekitar 2 menit sejak order dibuat.'
    case 'CONFLICT':
      return 'Order tidak bisa diproses pada statusnya sekarang (kemungkinan OTP sudah masuk atau sudah selesai).'
    case 'VALIDATION_ERROR':
      return message || 'Parameter tidak valid.'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'Kunci idempotensi dipakai dengan data berbeda. Muat ulang lalu coba lagi.'
    case 'REQUEST_IN_PROGRESS':
      return 'Permintaan sebelumnya masih diproses server. Tunggu sebentar lalu coba lagi.'
    case 'RATE_LIMIT_EXCEEDED':
      return retry_after
        ? `Terlalu banyak permintaan. Coba lagi dalam ${retry_after} detik.`
        : 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
    case 'TEMP_BANNED_ABUSE_GUARD':
      return retry_after
        ? `Batas keamanan tercapai. Coba lagi dalam ${retry_after} detik.`
        : 'Batas keamanan tercapai karena terlalu banyak kegagalan. Coba lagi nanti.'
    case 'SERVICE_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return retry_after
        ? `Server SMSCode sedang bermasalah. Coba lagi dalam ${retry_after} detik.`
        : 'Server SMSCode sedang bermasalah. Coba lagi sebentar lagi.'
    case 'TIMEOUT':
      return 'Koneksi ke api.smscode.gg timeout. Periksa internet Anda.'
    case 'NETWORK_ERROR':
      return 'Tidak dapat terhubung ke api.smscode.gg. Periksa koneksi internet Anda.'
    case 'KEYRING_UNAVAILABLE':
      return 'Secret Service (mis. gnome-keyring) tidak tersedia. Token tidak bisa disimpan dengan aman.'
    case 'DECODE_ERROR':
      return 'Respons server tidak terbaca. Biasanya sementara — app akan mencoba lagi otomatis.'
    default:
      if (code.startsWith('HTTP_')) {
        return 'Server mengirim respons yang tidak valid — biasanya sementara. App mencoba lagi otomatis; periksa koneksi internet Anda.'
      }
      return message || `Kesalahan tak dikenal (${code}).`
  }
}
