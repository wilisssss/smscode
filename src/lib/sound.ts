// Mesin bunyi: native freedesktop sound via Rust (canberra-gtk-play) — legal,
// selalu lolos, tidak terikat autoplay policy Web Audio. Fallback ke Web Audio
// bila binary tidak tersedia.
//
// Event suara: 'otp' | 'orderCreated' | 'orderFinished' | 'orderCanceled'.
import { invoke } from '@tauri-apps/api/core'

export type SoundEvent = 'otp' | 'orderCreated' | 'orderFinished' | 'orderCanceled'

const NATIVE_SOUND: Record<SoundEvent, string> = {
  otp: 'message-new-instant',
  orderCreated: 'dialog-information',
  orderFinished: 'complete',
  orderCanceled: 'bell',
}

// Frekuensi nada fallback Web Audio [freq, startOffset, duration]
const FALLBACK_NOTES: Record<SoundEvent, Array<[number, number, number]>> = {
  otp: [
    [659.25, 0, 0.34], // E5
    [880.0, 0.18, 0.5], // A5
  ],
  orderCreated: [
    [587.33, 0, 0.3], // D5
    [739.99, 0.16, 0.38], // F#5
  ],
  orderFinished: [
    [659.25, 0, 0.28],
    [987.77, 0.15, 0.45], // B5
  ],
  orderCanceled: [
    [523.25, 0, 0.22], // C5
    [392.0, 0.18, 0.4], // G4
  ],
}

// ── Flag global yang disinkronkan oleh PrefsProvider ────────────────────────
let soundEnabled = true
let quietHours = { enabled: false, start: '22:00', end: '07:00' }

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function setQuietHours(value: { enabled: boolean; start: string; end: string }): void {
  quietHours = value
}

/** true bila sekarang berada di dalam jam tenang. */
export function isQuietHoursNow(date = new Date()): boolean {
  if (!quietHours.enabled) return false
  const [startH, startM] = quietHours.start.split(':').map(Number)
  const [endH, endM] = quietHours.end.split(':').map(Number)
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return false
  const now = date.getHours() * 60 + date.getMinutes()
  const start = startH * 60 + startM
  const end = endH * 60 + endM
  // Rentang normal (08:00→17:00) atau tengah malam (22:00→07:00)
  return start <= end ? now >= start && now < end : now >= start || now < end
}

export async function playEventSound(event: SoundEvent): Promise<void> {
  if (!soundEnabled) return
  if (isQuietHoursNow()) return
  try {
    const played = await invoke<boolean>('play_system_sound', { name: NATIVE_SOUND[event] })
    if (played) return
  } catch {
    /* fallback */
  }
  await playWithWebAudio(event)
}

// ── Fallback: Web Audio ─────────────────────────────────────────────────────
let sharedCtx: AudioContext | null = null

function ensureContext(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      sharedCtx = new Ctor()
    }
    return sharedCtx
  } catch {
    return null
  }
}

/** Panggil dari gesture pertama (pointerdown/keydown) agar autoplay policy lolos. */
export function primeAudio(): void {
  void ensureContext()?.resume().catch(() => {})
}

function note(ctx: AudioContext, freq: number, startAt: number, duration: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

async function playWithWebAudio(event: SoundEvent): Promise<void> {
  const ctx = ensureContext()
  if (!ctx) return
  try {
    await ctx.resume()
    const now = ctx.currentTime + 0.01
    for (const [freq, offset, duration] of FALLBACK_NOTES[event]) {
      note(ctx, freq, now + offset, duration)
    }
  } catch {
    /* audio tidak tersedia / diblokir policy — abaikan */
  }
}
