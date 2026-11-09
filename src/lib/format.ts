const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const num = new Intl.NumberFormat('id-ID')

export const formatIDR = (value: number): string => idr.format(value)
export const formatNumber = (value: number): string => num.format(value)

const dtf = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const dtfTime = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return dtf.format(date)
}

/** "04 Nov · 14:02:11" untuk log SMS. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return dtfTime.format(date)
}

/** Sensor nomor telepon untuk screenshot/berbagi layar. */
export function maskPhone(phone: string): string {
  if (phone.length <= 7) return phone
  return `${phone.slice(0, 5)}•••${phone.slice(-2)}`
}

/** Sisa waktu sebagai milidetik; 0 jika sudah lewat / timestamp tidak valid. */
export function msUntil(iso: string | null | undefined): number {
  if (!iso) return 0
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return 0
  return Math.max(0, target - Date.now())
}

/** "04:32" atau "1:02:15" untuk hitung mundur. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}
