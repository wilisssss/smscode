import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import pkg from '../../package.json'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  Laptop,
  Moon,
  Sun,
  Trash2,
  Upload,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isEnabled as autostartIsEnabled, enable as autostartEnable, disable as autostartDisable } from '@tauri-apps/plugin-autostart'

import { clearToken, saveToken, testConnection } from '../lib/api'
import { clearOtpLog, loadOtpLog } from '../lib/otpLog'
import { listTemplates } from '../lib/templates'
import { friendlyError } from '../lib/errors'
import { formatIDR } from '../lib/format'
import { usePrefs } from '../lib/prefs'
import { Button, Input, Select } from '../components/ui'
import { clsx } from 'clsx'

/** Opsi jeda polling (detik); nilai lain dari backup lama tetap ditampilkan. */
const POLL_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 60]

export default function Settings() {
  const queryClient = useQueryClient()
  const { prefs, updatePrefs } = usePrefs()
  const pollOptions = Array.from(new Set([...POLL_OPTIONS, prefs.pollIntervalSec])).sort((a, b) => a - b)

  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmClearLog, setConfirmClearLog] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [autostart, setAutostart] = useState<boolean | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  // ── Backup JSON ──────────────────────────────────────────────────────────
  const exportBackup = () => {
    const payload = {
      app: 'smscode-desktop',
      version: 1,
      exportedAt: new Date().toISOString(),
      prefs: prefsRaw(),
      templates: listTemplates(),
      otpLog: loadOtpLog(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smscode-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('Backup JSON diunduh.')
  }

  const prefsRaw = (): unknown => {
    try {
      return JSON.parse(localStorage.getItem('smscode-prefs') ?? 'null')
    } catch {
      return null
    }
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      if (data.app !== 'smscode-desktop') throw new Error('bukan file backup SMSCode Desktop')
      if (data.prefs && typeof data.prefs === 'object') {
        updatePrefs(data.prefs as Partial<import('../lib/prefs').Prefs>)
      }
      if (Array.isArray(data.templates)) {
        localStorage.setItem('smscode-templates', JSON.stringify(data.templates))
      }
      if (Array.isArray(data.otpLog)) {
        localStorage.setItem('smscode-otp-log', JSON.stringify(data.otpLog))
      }
      toast.success('Backup berhasil diimpor (token API tidak berubah).')
    } catch {
      toast.error('Gagal mengimpor — file tidak valid.')
    }
  }

  const clearAllPreferences = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    localStorage.removeItem('smscode-prefs')
    localStorage.removeItem('smscode-templates')
    clearOtpLog()
    setConfirmReset(false)
    toast.success('Semua pengaturan direset ke bawaan.')
    window.location.reload()
  }

  useEffect(() => {
    autostartIsEnabled().then(setAutostart).catch(() => setAutostart(null))
  }, [])

  const refreshTokenState = async () => {
    await queryClient.invalidateQueries({ queryKey: ['has-token'] })
    await queryClient.invalidateQueries({ queryKey: ['balance'] })
    await queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  const onSave = async () => {
    setSaving(true)
    try {
      await saveToken(token)
      toast.success('Token tersimpan dengan aman.')
      setToken('')
      setConfirmClear(false)
      await refreshTokenState()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const onTest = async () => {
    setTesting(true)
    try {
      const balance = await testConnection()
      toast.success(`Koneksi OK — saldo ${formatIDR(balance.balance)}`)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setTesting(false)
    }
  }

  const onClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    try {
      await clearToken()
      // Hapus cache query (saldo / order) supaya data tidak tersisa di memori.
      queryClient.clear()
      toast.success('Token dihapus.')
      setConfirmClear(false)
      await refreshTokenState()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  const onClearLog = () => {
    if (!confirmClearLog) {
      setConfirmClearLog(true)
      return
    }
    clearOtpLog()
    setConfirmClearLog(false)
    toast.success('Riwayat SMS lokal dihapus dari perangkat ini.')
  }

  const toggleAutostart = async () => {
    const next = !(autostart ?? false)
    try {
      if (next) await autostartEnable()
      else await autostartDisable()
      setAutostart(next)
      toast.success(next ? 'Autostart aktif — aplikasi terbuka saat login.' : 'Autostart dimatikan.')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted mt-1">Token disimpan aman: Secret Service di desktop, file privat aplikasi di Android.</p>
      </header>

      {/* ── Token API ─────────────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="token-heading">
        <div className="flex items-center gap-2.5 mb-1">
          <KeyRound size={17} className="text-indigo-400" aria-hidden />
          <h2 id="token-heading" className="font-semibold">Token API SMSCode</h2>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Buat token di <span className="text-[var(--color-text)]">Account Settings → API</span> pada dashboard SMSCode, lalu tempel di bawah.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="sms_live_…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Token API"
            className="flex-1 font-mono"
          />
          <div className="flex gap-2">
            <Button onClick={onSave} loading={saving} disabled={token.trim().length < 8}>
              Simpan
            </Button>
            <Button variant="outline" onClick={onTest} loading={testing}>
              Test Koneksi
            </Button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted max-w-md leading-relaxed">
            Menghapus token tidak menyentuh saldo atau order Anda — hanya kredensial lokal yang dihapus.
          </p>
          <Button variant={confirmClear ? 'danger' : 'ghost'} size="sm" onClick={onClear}>
            <Trash2 size={14} aria-hidden />
            {confirmClear ? 'Klik lagi untuk hapus' : 'Hapus Token'}
          </Button>
        </div>
      </section>

      {/* ── Tampilan ──────────────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="theme-heading">
        <h2 id="theme-heading" className="font-semibold">Tampilan</h2>
        <p className="text-xs text-muted mt-1">Tema gelap adalah bawaan; &ldquo;Sistem&rdquo; mengikuti preferensi desktop Anda.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ThemeOption icon={Moon} label="Gelap" active={prefs.theme === 'dark'} onSelect={() => updatePrefs({ theme: 'dark' })} />
          <ThemeOption icon={Sun} label="Terang" active={prefs.theme === 'light'} onSelect={() => updatePrefs({ theme: 'light' })} />
          <ThemeOption icon={Laptop} label="Sistem" active={prefs.theme === 'system'} onSelect={() => updatePrefs({ theme: 'system' })} />
        </div>
      </section>

      {/* ── Pembaruan data ─────────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="polling-heading">
        <h2 id="polling-heading" className="font-semibold">Pembaruan Order</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Seberapa sering aplikasi mengecek order &amp; SMS baru ke server. Default 4 detik.
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-medium">Jeda polling</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Berlaku segera tanpa restart. Semakin kecil, OTP semakin cepat terdeteksi (minimal 2, maksimal 60 detik).
            </p>
          </div>
          <Select
            value={String(prefs.pollIntervalSec)}
            onChange={(e) => updatePrefs({ pollIntervalSec: Number(e.target.value) })}
            aria-label="Jeda polling"
            className="w-32 shrink-0"
          >
            {pollOptions.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} detik{seconds === 4 ? ' (default)' : ''}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {/* ── Perilaku ──────────────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="behavior-heading">
        <h2 id="behavior-heading" className="font-semibold">Notifikasi &amp; Perilaku</h2>
        <ToggleRow
          title="Notifikasi desktop untuk event penting"
          description="Banner sistem untuk OTP masuk, order dibuat/selesai/dibatalkan — walau jendela tidak fokus."
          checked={prefs.notifications}
          onToggle={() => updatePrefs({ notifications: !prefs.notifications })}
        />
        <ToggleRow
          title="Bunyi untuk event penting"
          description="Sound sistem (canberra) + chime cadangan: OTP masuk, order dibuat, selesai, dibatalkan."
          checked={prefs.soundOnOtp}
          onToggle={() => updatePrefs({ soundOnOtp: !prefs.soundOnOtp })}
        />
        <ToggleRow
          title="Auto-salin OTP ke clipboard"
          description="Kode 6 digit langsung siap ditempel di aplikasi tujuan."
          checked={prefs.autoCopyOtp}
          onToggle={() => updatePrefs({ autoCopyOtp: !prefs.autoCopyOtp })}
        />
        <ToggleRow
          title="Mulai otomatis saat login"
          description="Jendela aplikasi terbuka otomatis saat login."
          checked={autostart ?? false}
          disabled={autostart === null}
          onToggle={toggleAutostart}
        />
        <div className="flex flex-col gap-3 py-3 border-t border-line sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Riwayat SMS lokal</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Kode/pesan yang teramati tersimpan hanya di perangkat ini (maks. 200 entri terakhir). Tidak pernah dikirim ke server mana pun.
            </p>
          </div>
          <Button variant={confirmClearLog ? 'danger' : 'ghost'} size="sm" onClick={onClearLog} className="self-start shrink-0 sm:self-auto">
            <Trash2 size={14} aria-hidden />
            {confirmClearLog ? 'Klik lagi untuk hapus' : 'Hapus Riwayat'}
          </Button>
        </div>
      </section>

      {/* ── Privasi ─────────────────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="font-semibold">Privasi</h2>
        <ToggleRow
          title="Tampilkan nomor & kode di notifikasi"
          description="Matikan untuk banner umum (tanpa nomor/OTP) — cocok untuk layar bersama."
          checked={prefs.showDetailsInNotifications}
          onToggle={() => updatePrefs({ showDetailsInNotifications: !prefs.showDetailsInNotifications })}
        />
        <ToggleRow
          title="Sembunyikan nomor di aplikasi"
          description="Nomor tampil seperti +6281•••90 — tombol salin tetap menyalin nomor asli."
          checked={prefs.maskPhone}
          onToggle={() => updatePrefs({ maskPhone: !prefs.maskPhone })}
        />
        <div className="py-3">
          <ToggleRow
            title="Jam tenang (bunyi dibisukan)"
            description="Di rentang waktu ini, bunyi sistem tidak dikeluarkan (notifikasi & banner tetap jalan)."
            checked={prefs.quietHours.enabled}
            onToggle={() => updatePrefs({ quietHours: { ...prefs.quietHours, enabled: !prefs.quietHours.enabled } })}
          />
          <div className="flex items-center gap-2 mt-2 pl-1 flex-wrap">
            <input
              type="time"
              value={prefs.quietHours.start}
              onChange={(e) => updatePrefs({ quietHours: { ...prefs.quietHours, start: e.target.value } })}
              aria-label="Jam tenang mulai"
              className="h-9 px-2 rounded-lg bg-[var(--color-panel-2)] border border-line text-sm"
            />
            <span className="text-muted text-xs">→</span>
            <input
              type="time"
              value={prefs.quietHours.end}
              onChange={(e) => updatePrefs({ quietHours: { ...prefs.quietHours, end: e.target.value } })}
              aria-label="Jam tenang selesai"
              className="h-9 px-2 rounded-lg bg-[var(--color-panel-2)] border border-line text-sm"
            />
            <span className="text-xs text-muted">mis. 22:00 → 07:00 (tengah malam) atau 12:00 → 13:00</span>
          </div>
        </div>
      </section>

      {/* ── Backup ──────────────────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="font-semibold">Backup</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Unduh preferensi + Template Favorit + Riwayat SMS lokal sebagai JSON. Token API tidak ikut backup.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportBackup}>
            <Download size={14} aria-hidden /> Export Backup
          </Button>
          <label className="inline-flex items-center cursor-pointer">
            <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={importBackup} aria-label="Impor backup JSON" />
            <span className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs rounded-lg font-medium border border-[var(--color-line-strong)] hover:bg-[var(--color-panel-2)] transition-colors">
              <Upload size={14} aria-hidden /> Import Backup
            </span>
          </label>
          <Button variant={confirmReset ? 'danger' : 'ghost'} size="sm" onClick={clearAllPreferences}>
            <Trash2 size={14} aria-hidden /> {confirmReset ? 'Klik lagi untuk reset' : 'Reset Semua Pengaturan'}
          </Button>
        </div>
      </section>

      {/* ── Tentang / top-up ──────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="about-heading">
        <h2 id="about-heading" className="font-semibold">Akun &amp; Top Up</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Isi saldo dan kelola metode pembayaran dilakukan di situs SMSCode — demi keamanan, kredensial pembayaran tidak pernah masuk aplikasi ini.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void openUrl('https://smscode.gg')}>
            <Wallet size={14} aria-hidden /> Isi Saldo di Dashboard
            <ExternalLink size={12} aria-hidden className="text-muted" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => void openUrl('https://smscode.gg/docs')}>
            Dokumentasi API
            <ExternalLink size={12} aria-hidden className="text-muted" />
          </Button>
        </div>
        <div className="mt-5 pt-4 border-t border-line flex items-center gap-2 text-xs text-muted">
          <CheckCircle2 size={13} className="text-emerald-400" aria-hidden />
          SMSCode Desktop v{pkg.version} · API v1 (IDR) · Polling di Rust · Tanpa telemetry
        </div>
      </section>
    </div>
  )
}

function ThemeOption({
  icon: Icon,
  label,
  active,
  onSelect,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={clsx(
        'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-xs font-medium transition-colors',
        active
          ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
          : 'border-line text-muted hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]',
      )}
    >
      <Icon size={18} aria-hidden />
      {label}
    </button>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
  disabled,
}: {
  title: string
  description: string
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40',
          checked ? 'bg-indigo-500' : 'bg-[var(--color-panel-2)] border border-[var(--color-line)]',
        )}
      >
        <span
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </button>
    </div>
  )
}
