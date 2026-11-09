import { useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'

import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { CommandPalette } from './components/CommandPalette'
import { PrefsProvider, usePrefs } from './lib/prefs'
import { OrdersProvider, useOrders } from './lib/orders'
import { hasToken } from './lib/api'
import { friendlyError } from './lib/errors'
import { copyText } from './lib/clipboard'
import { announce } from './lib/notify'
import { formatIDR } from './lib/format'
import { appendOtpLog, type OtpLogEntry } from './lib/otpLog'
import { primeAudio } from './lib/sound'
import type { Order } from './lib/types'
import OrderWizard from './pages/OrderWizard'
import ActiveOrders from './pages/ActiveOrders'
import History from './pages/History'
import Settings from './pages/Settings'

const ACTIVE_STATUSES = new Set(['ACTIVE', 'OTP_RECEIVED'])

function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { prefs } = usePrefs()
  const { orders, loaded } = useOrders()

  const tokenQuery = useQuery({ queryKey: ['has-token'], queryFn: hasToken, staleTime: 60_000, retry: false })
  const hasValidToken = tokenQuery.data === true

  // Audio unlock: gesture pertama (klik/keyboard) agar chime OTP boleh bunyi.
  useEffect(() => {
    const unlock = () => primeAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const activeCount = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
    [orders],
  )

  // Deteksi SMS baru (revision naik — termasuk SMS tanpa konten terbaca) dan
  // order kedaluwarsa (dikembalikan saldo) dengan membandingkan snapshot.
  const lastRevisionRef = useRef<Map<number, number> | null>(null)
  const prevStatusesRef = useRef<Map<number, string> | null>(null)
  useEffect(() => {
    // JANGAN tandai baseline sebelum snapshot pertama tiba.
    if (!loaded) return

    // ── 1) Kedaluwarsa: status berubah ACTIVE/OTP_RECEIVED → EXPIRED ──────
    const prevStatuses = prevStatusesRef.current
    if (prevStatuses) {
      for (const order of orders) {
        const before = prevStatuses.get(order.id)
        if (
          before &&
          (before === 'ACTIVE' || before === 'OTP_RECEIVED') &&
          order.status === 'EXPIRED'
        ) {
          const refund = order.amount != null ? ` — ${formatIDR(order.amount)} kembali ke saldo` : ''
          toast.info(`Order #${order.id} kedaluwarsa${refund}`, { duration: 8000 })
        }
      }
    }
    prevStatusesRef.current = new Map(orders.map((o) => [o.id, o.status]))

    // ── 2) SMS baru via revision naik ─────────────────────────────────────
    const prev = lastRevisionRef.current
    if (prev === null) {
      // Baseline pertama: catat SMS lama yang punya konten, tanpa notifikasi.
      lastRevisionRef.current = new Map(orders.map((o) => [o.id, o.sms_revision ?? 0]))
      appendOtpLog(orders.filter(hasRevisionSignal).map(toLogEntry))
      return
    }

    const fresh: Order[] = []
    const next = new Map(prev)
    for (const order of orders) {
      const rev = order.sms_revision ?? 0
      const before = prev.get(order.id)
      if (before === undefined) {
        // Order baru — baseline, bukan SMS baru.
        next.set(order.id, rev)
        continue
      }
      if (rev > before) {
        fresh.push(order)
        next.set(order.id, rev)
      }
    }
    lastRevisionRef.current = next
    if (fresh.length === 0) return

    appendOtpLog(fresh.map(toLogEntry))
    for (const order of fresh) {
      // Order sudah selesai/batal/kedaluwarsa: catat saja, jangan berisik.
      if (order.status !== 'ACTIVE' && order.status !== 'OTP_RECEIVED') continue
      if (!hasRevisionSignal(order)) continue // SMS kosong — diam saja
      void deliverOtp(order, prefs.autoCopyOtp)
    }
  }, [orders, loaded, prefs.autoCopyOtp])

  const [paletteOpen, setPaletteOpen] = useState(false)

  // Shortcut global: Ctrl/Cmd+K = command palette, Ctrl/Cmd+1..4 = pindah halaman
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      const idx = ['1', '2', '3', '4'].indexOf(key)
      if (idx >= 0) {
        event.preventDefault()
        navigate(['/', '/aktif', '/riwayat', '/pengaturan'][idx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  // Kalau user baru saja menyimpan token, refresh saldo.
  useEffect(() => {
    if (hasValidToken) {
      void queryClient.invalidateQueries({ queryKey: ['balance'] })
    }
  }, [hasValidToken, queryClient])

  const showTokenBanner = tokenQuery.data === false && location.pathname !== '/pengaturan'

  // Elemen route dibuat sekali — tidak dibuat ulang di setiap render.
  const routes = useMemo(
    () => (
      <Routes>
        <Route path="/" element={<OrderWizard />} />
        <Route path="/aktif" element={<ActiveOrders />} />
        <Route path="/riwayat" element={<History />} />
        <Route path="/pengaturan" element={<Settings />} />
        <Route path="*" element={<OrderWizard />} />
      </Routes>
    ),
    [],
  )

  return (
    <div
      className="h-screen flex overflow-hidden"
      // Android edge-to-edge (targetSdk 37): konten digambar di bawah status bar,
      // jadi beri ruang sesuai inset aman atas. Di desktop env() = 0.
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Lewati ke konten utama
      </a>
      <Sidebar activeCount={activeCount} />
      <main id="main-content" className="flex-1 h-full overflow-y-auto app-bg pb-20 md:pb-0">
        {tokenQuery.isError && location.pathname !== '/pengaturan' && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
            <TriangleAlert size={16} aria-hidden className="shrink-0" />
            <p className="flex-1">{friendlyError(tokenQuery.error)}</p>
            <button
              onClick={() => void tokenQuery.refetch()}
              className="shrink-0 font-semibold underline underline-offset-2 hover:text-rose-200"
            >
              Coba lagi
            </button>
          </div>
        )}
        {showTokenBanner && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
            <TriangleAlert size={16} aria-hidden className="shrink-0" />
            <p className="flex-1">Token API belum diatur — aplikasi belum bisa terhubung ke SMSCode.</p>
            <button
              onClick={() => navigate('/pengaturan')}
              className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-200"
            >
              Atur sekarang
            </button>
          </div>
        )}
        {routes}
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </main>
      <MobileNav activeCount={activeCount} />
    </div>
  )
}

/** SMS baru = `sms_revision` naik; yang dihitung sebagai sinyal: ada kode atau ada isi pesan. */
function hasRevisionSignal(order: Order): boolean {
  return order.otp_code !== null || order.otp_message !== null
}

function otpKey(order: Order): string {
  return `${order.id}:${order.sms_revision ?? 0}`
}

function toLogEntry(order: Order): OtpLogEntry {
  return {
    id: otpKey(order),
    orderId: order.id,
    phone: order.phone_number ?? null,
    smsRevision: order.sms_revision ?? 0,
    code: order.otp_code,
    message: order.otp_message,
    at: order.otp_received_at ?? new Date().toISOString(),
  }
}

async function deliverOtp(order: Order, copy: boolean) {
  // Bunyi + notifikasi desktop (menghormati preferensi pengguna)
  void announce(
    'otp',
    'OTP diterima',
    `${order.phone_number ?? `Order #${order.id}`}${order.otp_code ? ` — kode: ${order.otp_code}` : ' — SMS tanpa kode terklasifikasi'}`,
  )
  const code = order.otp_code
  if (!code) return
  if (copy) {
    const ok = await copyText(code)
    if (ok) {
      toast.success(`OTP untuk ${order.phone_number ?? `order #${order.id}`} tersalin ke clipboard`)
    } else {
      toast.error('OTP diterima, tetapi gagal disalin otomatis ke clipboard')
    }
  }
}

export default function App() {
  return (
    <HashRouter>
      <PrefsProvider>
        <OrdersProvider>
          <Shell />
        </OrdersProvider>
        <Toaster theme="system" position="bottom-right" richColors closeButton />
      </PrefsProvider>
    </HashRouter>
  )
}
