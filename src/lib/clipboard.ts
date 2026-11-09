// Penyalinan teks berlapis agar tetap bekerja di desktop maupun Android.
//
// Lapisan utama: plugin Tauri (`clipboard-manager`) — satu-satunya jalur yang
// bekerja tanpa gesture pengguna, mis. auto-salin OTP setelah polling. Plugin
// WAJIB diberi izin `clipboard-manager:allow-write-text` di capabilities;
// `clipboard-manager:default` justru tidak mengizinkan apa pun.
//
// Cadangan: Clipboard API browser (butuh secure context + gesture) dan
// `document.execCommand('copy')` lama (didukung WebKitGTK/WebView).
import { writeText as tauriWriteText } from '@tauri-apps/plugin-clipboard-manager'

/**
 * Menyalin `text` ke clipboard. Mengembalikan `true` bila salah satu jalur
 * berhasil. Kegagalan dicatat ke console agar tidak lagi "hilang diam-diam".
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false

  try {
    await tauriWriteText(text)
    return true
  } catch (err) {
    console.warn('Clipboard plugin gagal, mencoba Clipboard API:', err)
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (err) {
    console.warn('navigator.clipboard gagal, mencoba execCommand:', err)
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, area.value.length)
    const ok = document.execCommand('copy')
    area.remove()
    if (!ok) console.warn('execCommand("copy") mengembalikan false')
    return ok
  } catch (err) {
    console.warn('Penyalinan ke clipboard gagal total:', err)
    return false
  }
}
