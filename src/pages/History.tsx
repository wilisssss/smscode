import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarDays,
  ChevronRight,
  ClipboardCopy,
  History as HistoryIcon,
  Inbox,
  RotateCw,
  Plus,
  Search,
  X,
  Zap,
} from 'lucide-react'

import {
  listOrders,
  newIdempotencyKey,
  reactivateOptions,
  reactivateOrder,
} from '../lib/api'
import { useOrders } from '../lib/orders'
import { announce } from '../lib/notify'
import { copyText } from '../lib/clipboard'
import { friendlyError } from '../lib/errors'
import { usePrefs } from '../lib/prefs'
import { otpLogFor, type OtpLogEntry } from '../lib/otpLog'
import { formatDateTime, formatIDR, maskPhone } from '../lib/format'
import type { Order } from '../lib/types'
import { Button, EmptyState, Input, Select, Spinner } from '../components/ui'
import { CopyButton } from '../components/CopyButton'
import { Modal } from '../components/Modal'
import { ReorderDialog } from '../components/ReorderDialog'
import { StatusBadge } from '../components/StatusBadge'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Semua status' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELED', label: 'Dibatalkan' },
  { value: 'EXPIRED', label: 'Kedaluwarsa' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'OTP_RECEIVED', label: 'OTP diterima' },
] as const

export default function History() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refresh } = useOrders()
  const { prefs } = usePrefs()
  const [status, setStatus] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reorderTarget, setReorderTarget] = useState<Order | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<Order | null>(null)
  const [otpTarget, setOtpTarget] = useState<Order | null>(null)

  const historyQuery = useQuery({
    queryKey: ['orders', 'history', status],
    queryFn: () => listOrders(50, 0, status === 'ALL' ? undefined : status),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = historyQuery.data ?? []
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null
    return rows.filter((o) => {
      const matchesQuery =
        !q ||
        String(o.id).includes(q) ||
        (o.phone_number ?? '').includes(q) ||
        (o.operator_name ?? '').toLowerCase().includes(q)
      if (!matchesQuery) return false
      if (from === null && to === null) return true
      if (!o.created_at) return false
      const t = new Date(o.created_at).getTime()
      if (Number.isNaN(t)) return false
      if (from !== null && t < from) return false
      if (to !== null && t > to) return false
      return true
    })
  }, [historyQuery.data, search, fromDate, toDate])

  // Statistik dari 50 order terakhir (bukan dari filter)
  const stats = useMemo(() => {
    const rows = historyQuery.data ?? []
    const completed = rows.filter((r) => r.status === 'COMPLETED')
    const expired = rows.filter((r) => r.status === 'EXPIRED')
    const base = completed.length + expired.length
    return {
      totalSpent: completed.reduce((sum, r) => sum + (r.amount ?? 0), 0),
      finished: completed.length,
      failed: expired.length,
      successRate: base > 0 ? Math.round((completed.length / base) * 100) : null,
    }
  }, [historyQuery.data])

  const copyCsv = async () => {
    const rows = filtered
    const header = 'id;created_at;phone_number;operator_name;amount_idr;status;otp_code'
    const lines = rows.map((o) =>
      [o.id, o.created_at ?? '', o.phone_number ?? '', o.operator_name ?? '', o.amount ?? '', o.status, o.otp_code ?? '']
        .map((cell) => csvEscape(String(cell)))
        .join(';'),
    )
    const ok = await copyText([header, ...lines].join('\n'))
    if (ok) {
      toast.warning(`${rows.length} baris tersalin — berisi nomor & kode OTP, jangan dibagikan.`)
    } else {
      toast.error('Gagal menyalin ke clipboard')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Riwayat Order</h1>
          <p className="text-sm text-muted mt-1">50 order terakhir. “Order Baru” menyewa nomor baru dengan produk yang sama.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyCsv} disabled={filtered.length === 0}>
            <ClipboardCopy size={14} aria-hidden /> Salin CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void historyQuery.refetch()} loading={historyQuery.isFetching}>
            <RotateCw size={14} aria-hidden /> Muat ulang
          </Button>
        </div>
      </header>

      {/* Statistik (dari 50 order terakhir, tidak terpengaruh filter) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="Ringkasan 50 order terakhir">
        <StatCard label="Total keluar (selesai)" value={formatIDR(stats.totalSpent)} />
        <StatCard label="Selesai / Gagal" value={`${stats.finished} / ${stats.failed}`} hint="Selesai vs kedaluwarsa" />
        <StatCard label="Success rate" value={stats.successRate === null ? '—' : `${stats.successRate}%`} hint="dari yang tidak dibatalkan" />
      </div>

      {/* Kontrol filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari order # / nomor / operator…"
            aria-label="Cari riwayat"
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status" className="w-44">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={15} className="text-muted shrink-0" aria-hidden />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="Dari tanggal"
            className="w-40"
          />
          <span className="text-muted text-xs">→</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="Sampai tanggal"
            className="w-40"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate('') }}
              aria-label="Bersihkan filter tanggal"
              title="Bersihkan filter tanggal"
              className="p-2 rounded-lg text-muted hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Konten */}
      {historyQuery.isLoading ? (
        <Spinner label="Memuat riwayat…" />
      ) : historyQuery.isError ? (
        <EmptyState
          icon={Inbox}
          title="Gagal memuat riwayat"
          description={friendlyError(historyQuery.error)}
          action={<Button onClick={() => void historyQuery.refetch()}>Coba lagi</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={search.trim() || fromDate || toDate ? 'Tidak ada yang cocok' : 'Belum ada order'}
          description={search.trim() || fromDate || toDate ? 'Periksa ejaan atau bersihkan filter (termasuk rentang tanggal).' : 'Order yang sudah dibuat akan tampil di sini.'}
          action={!search.trim() && <Button onClick={() => navigate('/')}><Zap size={15} aria-hidden /> Order Sekarang</Button>}
        />
      ) : (
        <>
          <p className="text-xs text-muted sm:hidden">Geser tabel ke samping untuk melihat kolom Status dan Aksi.</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted border-b border-line">
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Nomor</th>
                <th className="px-4 py-3 font-medium">Operator</th>
                <th className="px-4 py-3 font-medium text-right">Harga</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDateTime(order.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs select-all">
                      {prefs.maskPhone && order.phone_number ? maskPhone(order.phone_number) : (order.phone_number ?? '—')}
                    </span>
                    <span className="block text-xs text-muted">#{order.id}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{order.operator_name ?? 'Any'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">{order.amount != null ? formatIDR(order.amount) : '—'}</td>
                  <td className="px-4 py-3">
                    {canShowOtp(order) ? (
                      <button
                        type="button"
                        onClick={() => setOtpTarget(order)}
                        title="Lihat daftar OTP"
                        aria-label={`Lihat daftar OTP untuk order #${order.id}`}
                        className="inline-flex items-center gap-1 rounded-full focus-ring hover:opacity-80 transition-opacity"
                      >
                        <StatusBadge status={order.status} />
                        <ChevronRight size={14} className="text-muted" aria-hidden />
                      </button>
                    ) : (
                      <StatusBadge status={order.status} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {order.can_reactivate && (
                        <Button variant="outline" size="sm" onClick={() => setReactivateTarget(order)}>
                          Reactivate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReorderTarget(order)}
                        title="Sewa nomor baru dengan produk yang sama"
                      >
                        <Plus size={13} aria-hidden /> Order Baru
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Modal: Daftar OTP */}
      {otpTarget && <OtpDialog order={otpTarget} onClose={() => setOtpTarget(null)} />}

      {/* Modal: Order Baru */}
      {reorderTarget && (
        <ReorderDialog
          order={reorderTarget}
          onClose={() => setReorderTarget(null)}
          onDone={() => {
            setReorderTarget(null)
            void queryClient.invalidateQueries({ queryKey: ['orders', 'history'] })
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            refresh()
            navigate('/aktif')
          }}
        />
      )}

      {/* Modal: Reactivate */}
      {reactivateTarget && (
        <ReactivateDialog
          order={reactivateTarget}
          onClose={() => setReactivateTarget(null)}
          onDone={() => {
            setReactivateTarget(null)
            void queryClient.invalidateQueries({ queryKey: ['orders', 'history'] })
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            refresh()
            navigate('/aktif')
          }}
        />
      )}
    </div>
  )
}

function csvEscape(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

/** Status akhir yang menyimpan OTP — badge-nya bisa diklik untuk melihat daftar OTP. */
function canShowOtp(order: Order): boolean {
  return order.status === 'COMPLETED' || order.status === 'OTP_RECEIVED'
}

function OtpDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { prefs } = usePrefs()
  // Utamakan log lokal (berisi semua SMS), fallback ke OTP terakhir dari server.
  const entries = useMemo<OtpLogEntry[]>(() => {
    const logged = otpLogFor(order.id)
    if (logged.length > 0) return logged
    if (!order.otp_code) return []
    return [
      {
        id: `order:${order.id}`,
        orderId: order.id,
        phone: order.phone_number,
        smsRevision: order.sms_revision ?? 1,
        code: order.otp_code,
        message: order.otp_message,
        at: order.otp_received_at ?? order.created_at ?? new Date().toISOString(),
      },
    ]
  }, [order])

  const phone = order.phone_number
    ? prefs.maskPhone
      ? maskPhone(order.phone_number)
      : order.phone_number
    : null

  return (
    <Modal
      title="Daftar OTP"
      subtitle={`Order #${order.id}${phone ? ` · ${phone}` : ''}`}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Tutup</Button>}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">Tidak ada OTP tercatat untuk order ini.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-line bg-[var(--color-panel-2)]/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {entry.code ? (
                    <p className="font-mono text-lg font-bold tracking-[0.18em] select-all break-all">{entry.code}</p>
                  ) : (
                    <p className="text-sm text-muted break-words">{entry.message ?? 'SMS tanpa kode terklasifikasi'}</p>
                  )}
                  <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                    {formatDateTime(entry.at)} · sms#{entry.smsRevision}
                  </p>
                </div>
                <CopyButton text={entry.code ?? entry.message ?? ''} label="Salin OTP" className="shrink-0" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

function ReactivateDialog({
  order,
  onClose,
  onDone,
}: {
  order: Order
  onClose: () => void
  onDone: () => void
}) {
  const { prefs } = usePrefs()
  const [key] = useState(() => newIdempotencyKey())
  const optionsQuery = useQuery({
    queryKey: ['reactivate-options', order.id],
    queryFn: () => reactivateOptions(order.id),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: () => reactivateOrder(order.id, undefined, key),
    onSuccess: (result) => {
      const child = result.orders[0]
      toast.success(child ? `Nomor yang sama aktif kembali (order #${child.id})` : 'Reactivate berhasil')
      void announce('orderCreated', 'Nomor aktif kembali', `Reactivate berhasil${child ? ` — order #${child.id}` : ''}`)
      onDone()
    },
    onError: (err) => toast.error(friendlyError(err)),
  })

  const cost = optionsQuery.data?.cost

  return (
    <Modal
      title="Reactivate Nomor"
      subtitle="Menyewa nomor yang SAMA sekali lagi — tanpa nomor baru."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={cost === undefined}>
            Reaktivasi{cost !== undefined ? ` — ${formatIDR(cost)}` : ''}
          </Button>
        </>
      }
    >
      {optionsQuery.isLoading ? (
        <p className="text-sm text-muted">Memeriksa biaya reactivate…</p>
      ) : optionsQuery.isError ? (
        <p className="text-sm text-rose-300">{friendlyError(optionsQuery.error)}</p>
      ) : (
        <div className="text-sm leading-relaxed">
          <p className="text-muted">Nomor Anda:</p>
          <p className="font-mono font-semibold select-all mt-1">
            {prefs.maskPhone && order.phone_number ? maskPhone(order.phone_number) : order.phone_number}
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-[var(--color-panel-2)]/40 px-4 py-3">
            <span className="text-xs text-muted uppercase tracking-widest">Biaya sekarang</span>
            <span className="font-bold tabular-nums">{cost !== undefined ? formatIDR(cost) : '—'}</span>
          </div>
          <p className="mt-3 text-xs text-muted">Kuota SMS berikutnya akan langsung masuk setelah reaktivasi berhasil.</p>
        </div>
      )}
    </Modal>
  )
}
