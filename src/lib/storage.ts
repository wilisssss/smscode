// Kunci localStorage TERPUSAT + helper JSON aman (parse gagal → fallback,
// bukan crash). Semua modul yang menyimpan ke localStorage melewati sini.

export const STORAGE_KEYS = {
  prefs: 'smscode-prefs',
  otpLog: 'smscode-otp-log',
  templates: 'smscode-templates',
} as const

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota penuh / storage disabled — abaikan */
  }
}
