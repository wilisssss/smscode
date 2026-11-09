// Preferensi tampilan & perilaku, persist di localStorage (bukan rahasia).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { setSoundEnabled, setQuietHours } from './sound'
import { setNotificationsEnabled, setDetailsInNotifications } from './notify'
import { STORAGE_KEYS, readJson, writeJson } from './storage'

export type Theme = 'dark' | 'light' | 'system'

export interface QuietHours {
  enabled: boolean
  /** "HH:MM" 24 jam */
  start: string
  end: string
}

export interface Prefs {
  theme: Theme
  notifications: boolean
  autoCopyOtp: boolean
  soundOnOtp: boolean
  /** Tampilkan nomor & kode di banner notifikasi (kalau dimatikan: teks umum). */
  showDetailsInNotifications: boolean
  /** Sensor nomor di UI (untuk screenshot/berbagi layar). */
  maskPhone: boolean
  /** Jeda polling order di Rust, dalam detik (2–60). */
  pollIntervalSec: number
  /** Jam tenang — bunyi dibisukan di rentang ini. */
  quietHours: QuietHours
}

const STORAGE_KEY = STORAGE_KEYS.prefs

const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  notifications: true,
  autoCopyOtp: true,
  soundOnOtp: true,
  showDetailsInNotifications: true,
  maskPhone: false,
  pollIntervalSec: 4,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
}

function clampPollInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFS.pollIntervalSec
  return Math.min(60, Math.max(2, Math.round(value)))
}

function loadPrefs(): Prefs {
  const parsed = readJson<Partial<Prefs> | null>(STORAGE_KEY, null)
  if (!parsed) return DEFAULT_PREFS
  return {
    ...DEFAULT_PREFS,
    ...parsed,
    pollIntervalSec: clampPollInterval(parsed.pollIntervalSec ?? DEFAULT_PREFS.pollIntervalSec),
    quietHours: { ...DEFAULT_PREFS.quietHours, ...(parsed.quietHours ?? {}) },
  }
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return theme
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
}

interface PrefsContextValue {
  prefs: Prefs
  updatePrefs: (patch: Partial<Prefs>) => void
}

const PrefsContext = createContext<PrefsContextValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)

  useEffect(() => {
    applyTheme(prefs.theme)
    setSoundEnabled(prefs.soundOnOtp)
    setQuietHours(prefs.quietHours)
    setNotificationsEnabled(prefs.notifications)
    setDetailsInNotifications(prefs.showDetailsInNotifications)
    writeJson(STORAGE_KEY, prefs)

    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const listener = () => applyTheme('system')
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [prefs])

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => ({ ...current, ...patch }))
  }, [])

  // Terapkan jeda polling ke poller Rust (bukan timer JS).
  useEffect(() => {
    void invoke('set_poll_interval', { seconds: prefs.pollIntervalSec }).catch(() => {
      /* bukan lingkungan Tauri (mis. dev browser) — abaikan */
    })
  }, [prefs.pollIntervalSec])

  const value = useMemo(() => ({ prefs, updatePrefs }), [prefs, updatePrefs])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs harus dipakai di dalam PrefsProvider')
  return ctx
}
