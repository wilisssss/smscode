// Pengumuman event aplikasi: bunyi (via lib/sound) + notifikasi desktop.
// Masing-masing menghormati preferensi pengguna: soundOnOtp / notifications.
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { playEventSound, type SoundEvent } from './sound'

export type AnnounceEvent = Extract<SoundEvent, 'otp' | 'orderCreated' | 'orderFinished' | 'orderCanceled'>

let notificationsEnabled = true
let detailsEnabled = true

export function setNotificationsEnabled(enabled: boolean): void {
  notificationsEnabled = enabled
}

export function setDetailsInNotifications(enabled: boolean): void {
  detailsEnabled = enabled
}

const GENERIC_BODY: Record<AnnounceEvent, string> = {
  otp: 'Kode verifikasi baru tersedia — buka aplikasi.',
  orderCreated: 'Order baru berhasil dibuat.',
  orderFinished: 'Order ditandai selesai.',
  orderCanceled: 'Order dibatalkan.',
}

export async function announce(event: AnnounceEvent, title: string, body: string): Promise<void> {
  // Bunyi dikelola modul sound (cek soundOnOtp di dalamnya).
  void playEventSound(event)
  if (!notificationsEnabled) return
  const text = detailsEnabled ? body : GENERIC_BODY[event]
  try {
    let granted = await isPermissionGranted()
    if (!granted) {
      granted = (await requestPermission()) === 'granted'
    }
    if (granted) sendNotification({ title, body: text })
  } catch {
    /* notifikasi tidak tersedia — abaikan */
  }
}
