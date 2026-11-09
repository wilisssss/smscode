// Riwayat SMS/OTP lokal — dicatat oleh watcher setiap kali `sms_revision` naik.
// Tersimpan di localStorage (data sensitif: tetap di device ini, tidak dikirim ke mana pun).
// Maksimal 200 entri terakhir.
export interface OtpLogEntry {
  /** `${orderId}:${smsRevision}` — unik per SMS baru (revision monoton naik). */
  id: string
  orderId: number
  phone: string | null
  smsRevision: number
  code: string | null
  message: string | null
  /** ISO timestamp teramati (atau `otp_received_at` dari server saat baseline). */
  at: string
}

import { STORAGE_KEYS, readJson, writeJson } from './storage'

const STORAGE_KEY = STORAGE_KEYS.otpLog
const MAX_ENTRIES = 200

export function loadOtpLog(): OtpLogEntry[] {
  const parsed = readJson<OtpLogEntry[]>(STORAGE_KEY, [])
  return Array.isArray(parsed) ? parsed : []
}

/** Tambah entri (dedupe berdasarkan `id`), simpan 200 terakhir. */
export function appendOtpLog(entries: OtpLogEntry[]): void {
  if (entries.length === 0) return
  const byId = new Map(loadOtpLog().map((entry) => [entry.id, entry]))
  for (const entry of entries) byId.set(entry.id, entry)
  const merged = [...byId.values()]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-MAX_ENTRIES)
  writeJson(STORAGE_KEY, merged)
}

export function otpLogFor(orderId: number): OtpLogEntry[] {
  return loadOtpLog()
    .filter((entry) => entry.orderId === orderId)
    .sort((a, b) => b.smsRevision - a.smsRevision)
}

export function clearOtpLog(): void {
  localStorage.removeItem(STORAGE_KEY)
}
