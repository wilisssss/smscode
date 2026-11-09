// Sumber tunggal data order untuk UI — diisi oleh poller Rust via event
// `orders-updated` (push) atau `get_orders_snapshot` (saat pertama mount).
// Tidak ada setInterval di webview sama sekali.
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
import { listen } from '@tauri-apps/api/event'
import type { Order } from './types'

interface OrdersContextValue {
  orders: Order[]
  /** true setelah snapshot pertama (dari jaringan atau cache poller) diterima. */
  loaded: boolean
  /** Pesan error poll terakhir (null bila sehat). */
  error: string | null
  /** true saat menunggu hasil refresh berikutnya. */
  refreshing: boolean
  /** epoch ms terakhir data/heartbeat diterima (null bila belum). */
  lastUpdated: number | null
  /** Minta poller mengambil data SEKARANG (emit lebih cepat dari 4 detik). */
  refresh: () => void
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  useEffect(() => {
    // Data awal — bisa sudah ada bila aplikasi lama berjalan (mis. setelah restart).
    void invoke<Order[] | null>('get_orders_snapshot')
      .then((snapshot) => {
        if (snapshot) setOrders(snapshot)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))

    const unUpdated = listen<Order[]>('orders-updated', (event) => {
      setOrders(event.payload)
      setError(null)
      setLoaded(true)
      setRefreshing(false)
      setLastUpdated(Date.now())
    })
    const unHeartbeat = listen('orders-heartbeat', () => {
      setRefreshing(false)
      setLastUpdated(Date.now())
    })
    const unError = listen<{ code: string; message: string }>('orders-error', (event) => {
      setError(event.payload.message)
      setLoaded(true)
      setRefreshing(false)
    })
    return () => {
      void unUpdated.then((fn) => fn())
      void unHeartbeat.then((fn) => fn())
      void unError.then((fn) => fn())
    }
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    void invoke('refresh_orders')
  }, [])

  const value = useMemo(
    () => ({ orders, loaded, error, refreshing, lastUpdated, refresh }),
    [orders, loaded, error, refreshing, lastUpdated, refresh],
  )
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders harus dipakai di dalam OrdersProvider')
  return ctx
}
