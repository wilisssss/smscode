// Dialog "Order Baru" — sewa nomor BARU dengan tier/produk yang sama
// (order saat ini tidak terpengaruh). Dipakai di kartu Order Aktif dan Riwayat.
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createOrderWithRetry, getBalance, newIdempotencyKey } from '../lib/api'
import { announce } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { formatIDR, maskPhone } from '../lib/format'
import { usePrefs } from '../lib/prefs'
import type { Order } from '../lib/types'
import { Button } from './ui'
import { Modal } from './Modal'

export function ReorderDialog({
  order,
  onClose,
  onDone,
}: {
  order: Order
  onClose: () => void
  onDone: () => void
}) {
  const key = useMemo(() => newIdempotencyKey(), [])
  const queryClient = useQueryClient()
  const { prefs } = usePrefs()
  const balanceQuery = useQuery({ queryKey: ['balance'], queryFn: getBalance, staleTime: 30_000 })
  const balance = balanceQuery.data?.balance

  const mutation = useMutation({
    // Sama seperti order dari daftar harga: tier PERSIS (product_id) bila ada,
    // fallback ke routing umbrella (+operator) untuk order lama tanpa product_id.
    mutationFn: () =>
      createOrderWithRetry(
        order.product_id != null
          ? { product_id: order.product_id, quantity: 1, idempotencyKey: key }
          : {
              catalog_product_id: order.catalog_product_id ?? undefined,
              operator_id: order.operator_id ?? undefined,
              quantity: 1,
              idempotencyKey: key,
            },
      ),
    onSuccess: (result) => {
      const created = result.orders[0]
      toast.success(created ? `Order #${created.id} berhasil dibuat` : 'Order dibuat (sebagian mungkin gagal)')
      if (created) {
        void announce(
          'orderCreated',
          'Order baru dibuat',
          `#${created.id} · tier yang sama · ${order.operator_name ?? 'Any'}`,
        )
      }
      void queryClient.invalidateQueries({ queryKey: ['balance'] })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'history'] })
      onDone()
    },
    onError: (err) => toast.error(friendlyError(err)),
  })

  const canReorder = order.catalog_product_id != null || order.product_id != null
  const lastAmount = order.amount ?? null
  const saldoAfter = balance !== undefined && lastAmount !== null ? balance - lastAmount : undefined
  const saldoKurang = saldoAfter !== undefined && saldoAfter < 0

  return (
    <Modal
      title="Order Baru"
      subtitle="Menyewa nomor BARU dengan tier yang sama — cocok bila nomor aktif Anda ditolak/diblokir platform, tanpa menunggu 2 menit untuk cancel."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!canReorder}>
            Order Baru
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed">
        <p className="text-muted">Harga mengikuti tier saat ini di server (bisa naik/turun); stok bisa berubah:</p>
        <ul className="mt-3 space-y-1.5 font-medium">
          <li className="flex justify-between gap-4"><span className="text-muted font-normal">Order saat ini</span><span className="font-mono select-all">{order.phone_number ? (prefs.maskPhone ? maskPhone(order.phone_number) : order.phone_number) : `#${order.id}`}</span></li>
          <li className="flex justify-between gap-4"><span className="text-muted font-normal">Operator</span><span>{order.operator_name ?? 'Any'}</span></li>
          {lastAmount !== null && (
            <li className="flex justify-between gap-4"><span className="text-muted font-normal">Harga terakhir</span><span className="tabular-nums">{formatIDR(lastAmount)}</span></li>
          )}
          <li className="flex justify-between gap-4 border-t border-line pt-1.5">
            <span className="text-muted font-normal">Saldo</span>
            <span className="tabular-nums font-bold">{balance !== undefined ? formatIDR(balance) : '…'}</span>
          </li>
        </ul>
        {saldoKurang && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 leading-relaxed">
            Saldo Anda lebih kecil dari harga terakhir. Order bisa gagal (tanpa biaya) bila harga tier tidak turun — isi saldo dulu bila perlu.
          </p>
        )}
        {!canReorder && <p className="mt-3 text-xs text-rose-400">Order ini tidak menyimpan referensi produk — buat order manual dari halaman utama.</p>}
      </div>
    </Modal>
  )
}
