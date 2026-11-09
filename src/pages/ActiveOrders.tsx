import { useEffect, useMemo, useState, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  CheckCircle2,
  BellOff,
  Clock3,
  Inbox,
  List,
  Plus,
  RefreshCcw,
  Smartphone,
  TriangleAlert,
  XCircle,
  Zap,
} from 'lucide-react'

import {
  cancelOrder,
  finishOrder,
  resendOrder,
} from '../lib/api'
import { friendlyError } from '../lib/errors'
import { useOrders } from '../lib/orders'
import { announce } from '../lib/notify'
import { usePrefs } from '../lib/prefs'
import { formatCountdown, formatIDR, formatTime, maskPhone, msUntil } from '../lib/format'
import { otpLogFor } from '../lib/otpLog'
import type { Order } from '../lib/types'
import { Badge, Button, EmptyState, Spinner } from '../components/ui'
import { CopyButton } from '../components/CopyButton'
import { ReorderDialog } from '../components/ReorderDialog'
import { StatusBadge } from '../components/StatusBadge'
import { clsx } from 'clsx'

const ACTIVE_STATUSES = new Set(['ACTIVE', 'OTP_RECEIVED'])

export default function ActiveOrders() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { orders, loaded, error, refreshing, lastUpdated, refresh } = useOrders()
  const { prefs } = usePrefs()
  const [reorderTarget, setReorderTarget] = useState<Order | null>(null)

  const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status))

  const invalidate = useCallback(() => {
    refresh() // minta poller ambil snapshot SEGERA — UI terasa instan
    void queryClient.invalidateQueries({ queryKey: ['orders', 'history'] })
    void queryClient.invalidateQueries({ queryKey: ['balance'] })
  }, [refresh, queryClient])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            Order Aktif
            {active.length > 0 && <Badge tone="brand">{active.length} order</Badge>}
          </h1>
          <p className="text-sm text-muted mt-1">
            Daftar diperbarui otomatis setiap {prefs.pollIntervalSec} detik. Nomor ditolak platform? Klik <span className="text-[var(--color-text)] font-medium">Order Baru</span> di kartu untuk langsung sewa nomor baru.
          </p>
          <p className="text-xs text-muted mt-1.5 flex items-center gap-2 flex-wrap" aria-live="polite">
            {lastUpdated
              ? `Sinkronisasi terakhir ${new Date(lastUpdated).toLocaleTimeString('id-ID')}`
              : 'Menunggu sinkronisasi pertama…'}
            <span aria-hidden>·</span> otomatis tiap {prefs.pollIntervalSec} detik
            {refreshing && <span className="text-indigo-300 font-semibold">Menyegarkan…</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>
            <RefreshCcw size={14} aria-hidden /> Muat ulang
          </Button>
          {error && <p className="text-xs text-rose-300 max-w-56 text-right">Pembaruan otomatis gagal — {error}</p>}
        </div>
      </header>

      {!loaded ? (
        <Spinner label="Memuat order aktif…" />
      ) : error && active.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Order belum bisa dimuat"
          description={error}
          action={<Button onClick={refresh}>Coba lagi</Button>}
        />
      ) : active.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Belum ada order aktif"
          description="Saat nomor aktif disewa, di sinilah tempatnya menunggu kode OTP masuk."
          action={<Button onClick={() => navigate('/')}><Zap size={15} aria-hidden /> Order Sekarang</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((order) => (
            <ActiveOrderCard key={order.id} order={order} onChanged={invalidate} onOrderBaru={setReorderTarget} />
          ))}
        </div>
      )}

      {/* Dialog Order Baru (dengan produk/tier yang sama) */}
      {reorderTarget && (
        <ReorderDialog
          order={reorderTarget}
          onClose={() => setReorderTarget(null)}
          onDone={() => {
            setReorderTarget(null)
            invalidate()
          }}
        />
      )}
    </div>
  )
}

// ── Kartu satu order ──────────────────────────────────────────────────────────

const ActiveOrderCard = memo(function ActiveOrderCard({
  order,
  onChanged,
  onOrderBaru,
}: {
  order: Order
  onChanged: () => void
  onOrderBaru: (order: Order) => void
}) {
  const [, forceTick] = useState(0)
  const [showSmsLog, setShowSmsLog] = useState(false)
  const { prefs } = usePrefs()
  const displayPhone = order.phone_number
    ? prefs.maskPhone
      ? maskPhone(order.phone_number)
      : order.phone_number
    : '—'
  // Countdown 1 detik — cukup untuk window ±20 menit.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  // Setiap revision baru memicu re-render data polling → log ikut terbaca ulang.
  const smsEntries = useMemo(
    () => otpLogFor(order.id),
    [order.id, order.sms_revision],
  )

  const expiresInMs = msUntil(order.expires_at)
  const expiringSoon = order.expires_at !== null && expiresInMs > 0 && expiresInMs < 60_000

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: (result) => {
      const hasRefund = result.refund_amount != null
      const refundSuffix = hasRefund ? ` — ${formatIDR(result.refund_amount!)} kembali ke saldo` : ''
      toast.success(hasRefund ? `Order dibatalkan${refundSuffix}` : 'Order dibatalkan')
      void announce('orderCanceled', 'Order dibatalkan', `#${result.order_id}${refundSuffix}`)
      onChanged()
    },
    onError: (err) => toast.error(friendlyError(err)),
  })
  const finishMutation = useMutation({
    mutationFn: () => finishOrder(order.id),
    onSuccess: () => {
      toast.success('Order diselesaikan. Terima kasih!')
      void announce('orderFinished', 'Order selesai', `#${order.id} ditandai selesai. Terima kasih!`)
      onChanged()
    },
    onError: (err) => toast.error(friendlyError(err)),
  })
  const resendMutation = useMutation({
    mutationFn: () => resendOrder(order.id),
    onSuccess: (result) => {
      toast[result.resent ? 'success' : 'warning'](
        result.resent ? 'SMS diminta ulang ke nomor Anda.' : 'Platform tidak mendukung kirim ulang — OTP berikutnya masuk sendiri.',
      )
      onChanged()
    },
    onError: (err) => toast.error(friendlyError(err)),
  })

  const resendIsAuto = order.resend_mode === 'auto'
  const canResend = order.can_resend && !resendIsAuto

  // Alasan tombol Batalkan nonaktif — ditampilkan agar jujur soal aturan server.
  const cancelDisabledReason = buildCancelDisabledReason(order)

  return (
    <article className="card p-4 sm:p-5 flex flex-col gap-4" aria-label={`Order ${order.id}`}>
      {/* Baris status: badge + countdown; ID di kanan */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <StatusBadge status={order.status} />
          <CountdownPill iso={order.expires_at} expiringSoon={expiringSoon} />
        </div>
        <span className="text-xs text-muted tabular-nums shrink-0">#{order.id}</span>
      </div>

      {/* Nomor + tombol salin */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 shrink-0">
          <Smartphone size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className="font-mono text-base sm:text-lg font-semibold tracking-wide truncate select-all"
              title={prefs.maskPhone && order.phone_number ? 'Nomor disembunyikan (Pengaturan → Privasi)' : undefined}
            >
              {displayPhone}
            </p>
            {order.phone_number && <CopyButton text={order.phone_number} label="Salin nomor" className="shrink-0" />}
          </div>
          <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">
            {order.operator_name ? `${order.operator_name} · ` : ''}
            {order.amount != null ? formatIDR(order.amount) : '—'}
          </p>
        </div>
      </div>

      {/* Kegagalan dari sisi provider (jika ada) — selalu tampilkan, jangan disembunyikan */}
      {order.failed_reason && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300 flex items-start gap-2" role="alert">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />
          <span><span className="font-semibold">Gagal:</span> {order.failed_reason}</span>
        </div>
      )}

      {/* OTP / pesan */}
      <div className="rounded-2xl border border-line bg-[var(--color-panel-2)]/40 px-3 sm:px-5 py-4 min-h-[86px] flex items-center justify-center text-center">
        {order.otp_code ? (
          <div className="flex items-center justify-center gap-3 sm:gap-5 max-w-full">
            <p className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.2em] sm:tracking-[0.28em] text-emerald-300 select-all break-all">{order.otp_code}</p>
            <CopyButton text={order.otp_code} label="Salin kode OTP" className="h-10 w-10 shrink-0" />
          </div>
        ) : order.otp_message ? (
          <div className="flex items-start gap-3 max-w-md">
            <MessageSquareText size={17} className="text-muted shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs leading-relaxed text-left">
              <span className="block text-xs uppercase tracking-[0.18em] text-muted mb-1">SMS masuk (belum terklasifikasi)</span>
              {order.otp_message}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted">
            <Clock3 size={18} aria-hidden />
            <p className="text-xs">Menunggu SMS masuk… kode OTP tampil di sini otomatis.</p>
          </div>
        )}
      </div>

      {/* Riwayat SMS yang teramati (lokal) */}
      {smsEntries.length > 0 && (
        <div className="rounded-2xl border border-line overflow-hidden">
          <button
            onClick={() => setShowSmsLog((v) => !v)}
            aria-expanded={showSmsLog}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]/40 transition-colors"
          >
            <List size={15} aria-hidden />
            Riwayat SMS ({smsEntries.length})
            <span className="ml-auto flex items-center gap-1 text-xs font-normal">
              {showSmsLog ? 'Sembunyikan' : 'Tampilkan'}
              {showSmsLog ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </span>
          </button>
          {showSmsLog && (
            <div className="divide-y divide-line border-t border-line bg-[var(--color-panel-2)]/30">
              {smsEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
                  <Badge tone="neutral">sms#{entry.smsRevision}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0 flex-1">
                        {entry.code ? (
                          <span className="font-mono text-sm font-bold tracking-widest select-all">{entry.code}</span>
                        ) : (
                          <p className="text-sm text-muted break-words line-clamp-3" title={entry.message ?? undefined}>
                            {entry.message ?? 'SMS tanpa kode terklasifikasi'}
                          </p>
                        )}
                      </div>
                      {/* Tombol salin tepat di samping kode/pesan */}
                      <CopyButton text={entry.code ?? entry.message ?? ''} label="Salin SMS" className="shrink-0" />
                    </div>
                  </div>
                  <span className="text-[11px] text-muted tabular-nums whitespace-nowrap shrink-0 pt-1">{formatTime(entry.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aksi — 2 kolom di HP, sebaris di desktop */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
        <Button
          variant="ok"
          size="sm"
          className="w-full md:w-auto"
          disabled={!order.can_finish}
          loading={finishMutation.isPending}
          onClick={() => finishMutation.mutate()}
          title={order.can_finish ? 'Terima kode ini dan selesaikan order' : 'Tersedia setelah SMS diterima'}
        >
          <CheckCircle2 size={15} aria-hidden /> Selesai
        </Button>

        <Button
          variant="danger"
          size="sm"
          className="w-full md:w-auto"
          disabled={!order.can_cancel || cancelMutation.isPending}
          loading={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate()}
          title={cancelDisabledReason ?? 'Batalkan order dan dapatkan refund penuh'}
        >
          <XCircle size={15} aria-hidden /> Batalkan
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
          disabled={!canResend || resendMutation.isPending}
          loading={resendMutation.isPending}
          onClick={() => resendMutation.mutate()}
          title={
            resendIsAuto
              ? 'Platform ini otomatis mengirim SMS berikutnya — tombol tidak diperlukan'
              : canResend
                ? 'Minta platform mengirim ulang SMS'
                : 'Belum bisa kirim ulang saat ini'
          }
        >
          <RefreshCcw size={14} aria-hidden />
          <span className="md:hidden">Kirim Ulang</span>
          <span className="hidden md:inline">Kirim Ulang SMS</span>
          {resendIsAuto && <span className="text-xs uppercase tracking-widest text-muted ml-1">otomatis</span>}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
          onClick={() => onOrderBaru(order)}
          title="Nomor ditolak/diblokir platform? Sewa nomor baru dengan tier yang sama — tanpa menunggu 2 menit untuk cancel."
        >
          <Plus size={15} aria-hidden /> Order Baru
        </Button>

        <div className="hidden md:flex md:ml-auto items-center gap-3">
          <ResendHint order={order} />
          {!order.can_cancel && <CancelHint order={order} />}
        </div>
      </div>
    </article>
  )
})

function CountdownPill({ iso, expiringSoon }: { iso: string | null; expiringSoon: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-mono text-sm tabular-nums px-2.5 py-1 rounded-full border',
        expiringSoon ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : 'text-muted border-line bg-[var(--color-panel-2)]/40',
      )}
      title="Sisa waktu sebelum nomor kedaluwarsa dan saldo dikembalikan"
    >
      <Clock3 size={11} aria-hidden />
      {iso ? formatCountdown(msUntil(iso)) : '--:--'}
    </span>
  )
}

function ResendHint({ order }: { order: Order }) {
  if (order.resend_mode === 'auto') return null
  if (!order.can_resend && order.resend_available_at) {
    return (
      <span className="text-sm text-muted tabular-nums hidden md:inline" title="Kirim ulang tersedia pada waktu berikut">
        ulang dlm {formatCountdown(msUntil(order.resend_available_at))}
      </span>
    )
  }
  return null
}

function CancelHint({ order }: { order: Order }) {
  if (order.otp_code) {
    return <span className="text-sm text-muted hidden md:inline">OTP masuk — refund ditutup</span>
  }
  if (order.cancel_available_at) {
    return (
      <span className="text-sm text-muted tabular-nums hidden md:inline" title="Pembatalan baru bisa dilakukan pada waktu berikut">
        batal dlm {formatCountdown(msUntil(order.cancel_available_at))}
      </span>
    )
  }
  return <span className="text-sm text-muted hidden md:inline">Batal tersedia ±2 mnt setelah order</span>
}

function buildCancelDisabledReason(order: Order): string | undefined {
  if (order.can_cancel) return undefined
  if (order.otp_code) return 'SMS sudah masuk — refund tidak tersedia, selesaikan order.'
  if (order.cancel_available_at) return `Baru bisa dibatalkan pada ${new Date(order.cancel_available_at).toLocaleTimeString('id-ID')}`
  return 'Pembatalan tersedia sekitar 2 menit setelah order.'
}
