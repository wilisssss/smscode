import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Globe2,
  History,
  ListOrdered,
  PackageSearch,
  RotateCw,
  Plus,
  Search,
  Signal,
  Star,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'

import {
  createOrderWithRetry,
  getBalance,
  listCountries,
  listOperators,
  listProducts,
  listServices,
  newIdempotencyKey,
} from '../lib/api'
import { useOrders } from '../lib/orders'
import { listTemplates, removeTemplate, toggleTemplate, type Template } from '../lib/templates'
import { ReorderDialog } from '../components/ReorderDialog'
import { matchPopular } from '../lib/popular'
import { friendlyError } from '../lib/errors'
import { announce } from '../lib/notify'
import { formatIDR, formatNumber } from '../lib/format'
import type { Country, Operator, Order, Product, Service } from '../lib/types'
import { Badge, Button, EmptyState, Input, SkeletonGrid, Spinner } from '../components/ui'
import { Modal } from '../components/Modal'
import { clsx } from 'clsx'

type Step = 'service' | 'country' | 'operator' | 'products'
const STEP_ORDER: Step[] = ['service', 'country', 'operator', 'products']

type OperatorChoice = Operator | 'any' | null

// Autofocus hanya di desktop; di HP keyboard yang langsung muncul menutupi layar.
const AUTO_FOCUS = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

export default function OrderWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { orders, refresh } = useOrders()

  const [step, setStep] = useState<Step>('service')
  const [query, setQuery] = useState('')
  const [service, setService] = useState<Service | null>(null)
  const [country, setCountry] = useState<Country | null>(null)
  const [operator, setOperator] = useState<OperatorChoice>(null)
  const [orderProduct, setOrderProduct] = useState<Product | null>(null)
  const [visibleProducts, setVisibleProducts] = useState(5)
  const [templates, setTemplates] = useState<Template[]>(() => listTemplates())
  const [reorderTarget, setReorderTarget] = useState<Order | null>(null)
  // Order terakhir (maks 5) untuk chip "Order Terakhir" di beranda.
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders])
  // Tier yang harus langsung dibuka dialog konfirmasinya saat data harga tiba.
  const [focusProductId, setFocusProductId] = useState<number | null>(null)
  const autoOpenedRef = useRef<number | null>(null)

  const refreshTemplates = () => setTemplates(listTemplates())

  const balanceQuery = useQuery({ queryKey: ['balance'], queryFn: getBalance })
  const servicesQuery = useQuery({ queryKey: ['catalog-services'], queryFn: () => listServices(), staleTime: 5 * 60_000 })

  // Deep-link dari command palette (Ctrl+K → pilih layanan): langsung ke langkah Negara.
  useEffect(() => {
    const id = (location.state as { focusServiceId?: number } | null)?.focusServiceId
    if (id == null) return
    const found = (servicesQuery.data ?? []).find((s) => s.id === id)
    if (found) {
      setService(found)
      setStep('country')
      setQuery('')
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, servicesQuery.data, navigate])
  const countriesQuery = useQuery({
    queryKey: ['catalog-countries'],
    queryFn: listCountries,
    enabled: step !== 'service',
  })
  const operatorsQuery = useQuery({
    queryKey: ['catalog-operators', country?.id, service?.id],
    queryFn: () => listOperators(country!.id, service!.id),
    enabled: Boolean(country && service) && step === 'operator',
  })
  const productsQuery = useQuery({
    queryKey: ['catalog-products', country?.id, service?.id, operatorKey(operator)],
    queryFn: () =>
      listProducts(country!.id, service!.id, operator && operator !== 'any' ? (operator.operator_id ?? undefined) : undefined),
    enabled: Boolean(country && service && operator !== null) && step === 'products',
  })

  const resetTo = (target: Step) => {
    const index = STEP_ORDER.indexOf(target)
    if (index <= STEP_ORDER.indexOf('service')) { setService(null); setCountry(null); setOperator(null) }
    if (index <= STEP_ORDER.indexOf('country')) { setCountry(null); setOperator(null) }
    if (index <= STEP_ORDER.indexOf('operator')) setOperator(null)
    setQuery('')
    setVisibleProducts(5)
    setStep(target)
  }

  const popular = useMemo(() => matchPopular(servicesQuery.data ?? []), [servicesQuery.data])
  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (servicesQuery.data ?? []).filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    ).slice(0, 30)
  }, [query, servicesQuery.data])

  const activeCountries = useMemo(
    () => (countriesQuery.data ?? []).filter((c) => c.active !== false),
    [countriesQuery.data],
  )
  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activeCountries.slice(0, 10)
    return activeCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.dial_code.includes(q),
    )
  }, [query, activeCountries])

  const operatorLabel =
    operator === 'any' ? 'Any (operator mana pun)' : operator?.name ?? '—'

  /** Klik template favorit: langsung ke langkah harga dengan tier favorit ter-highlight & dialog konfirmasi terbuka otomatis. */
  const jumpToTemplate = (t: Template) => {
    setService({ id: t.serviceId, code: t.serviceCode, name: t.serviceName, active: true })
    setCountry({
      id: t.countryId,
      code: t.countryCode,
      name: t.countryName,
      dial_code: t.countryDialCode,
      emoji: t.countryEmoji,
      active: true,
    })
    setOperator(
      t.operatorId === null
        ? 'any'
        : { operator_id: t.operatorId, code: '', name: t.operatorName, local_name: null },
    )
    setFocusProductId(t.productId)
    autoOpenedRef.current = null
    setQuery('')
    setStep('products')
  }

  const toggleFavoriteProduct = (product: Product) => {
    if (!service || !country) return
    const result = toggleTemplate({
      productId: product.id,
      productName: product.name,
      price: product.price,
      available: product.available,
      serviceId: service.id,
      serviceName: service.name,
      serviceCode: service.code,
      countryId: country.id,
      countryName: country.name,
      countryCode: country.code,
      countryDialCode: country.dial_code,
      countryEmoji: country.emoji ?? null,
      operatorId: operator === 'any' || operator === null ? null : (operator.operator_id ?? null),
      operatorName: operatorLabel,
    })
    if (result === 'full') toast.error('Template favorit penuh (maks. 8) — hapus satu dulu.')
    else if (result === 'added') toast.success('Disimpan ke Template Favorit di beranda.')
    else toast.success('Template dihapus.')
    refreshTemplates()
  }

  // Buka dialog konfirmasi otomatis ketika tier favorit muncul di data harga (harga FRESH, bukan saat disimpan).
  useEffect(() => {
    if (focusProductId == null || step !== 'products') return
    const data = productsQuery.data
    if (!data) return
    if (autoOpenedRef.current === focusProductId) return
    autoOpenedRef.current = focusProductId
    const target = data.find((p) => p.id === focusProductId)
    if (target) setOrderProduct(target)
    else toast.warning('Tier favorit sedang tidak tersedia — pilih tier lain.')
  }, [focusProductId, step, productsQuery.data])

  // Kembali ke 5 baris setiap kali kombinasi layanan/negara/operator berubah.
  useEffect(() => {
    setVisibleProducts(5)
  }, [country?.id, service?.id, operatorKey(operator), step])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      {/* ── Header + saldo ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order Baru</h1>
          <p className="text-sm text-muted mt-1">
            Pilih layanan → negara → operator → harga, lalu order. OTP masuk otomatis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="card !rounded-xl px-4 py-2 flex items-center gap-3">
            <Wallet size={17} className="text-indigo-400" aria-hidden />
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Saldo</p>
              <p className="text-sm font-bold tabular-nums">
                {balanceQuery.isLoading ? '…' : balanceQuery.data ? formatIDR(balanceQuery.data.balance) : 'Gagal dimuat'}
              </p>
            </div>
            <button
              onClick={() => void balanceQuery.refetch()}
              aria-label="Muat ulang saldo"
              title="Muat ulang saldo"
              className="p-1.5 rounded-lg text-muted hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors"
            >
              <RotateCw size={15} className={balanceQuery.isFetching ? 'animate-spin' : ''} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      {step !== 'service' && (
        <nav className="flex items-center gap-1 text-xs text-muted flex-wrap" aria-label="Langkah order">
          <CrumbButton onClick={() => resetTo('service')} label="Layanan" />
          {service && (
            <>
              <ChevronRight size={12} aria-hidden />
              <CrumbButton onClick={() => resetTo('country')} label={service.name} />
            </>
          )}
          {country && (
            <>
              <ChevronRight size={12} aria-hidden />
              <CrumbButton onClick={() => resetTo('operator')} label={`${country.emoji ?? ''} ${country.name}`.trim()} />
            </>
          )}
          {operator !== null && (
            <>
              <ChevronRight size={12} aria-hidden />
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 font-medium border border-indigo-500/20">
                {operatorLabel}
              </span>
            </>
          )}
        </nav>
      )}

      {/* ── Langkah 1: Layanan ─────────────────────────────────────────── */}
      {step === 'service' && (
        <section className="flex flex-col gap-4">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Cari layanan… mis. WhatsApp, Telegram, Google"
            autoFocus={AUTO_FOCUS}
          />
          {!query.trim() && templates.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="Template favorit">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-muted flex items-center gap-2">
                  <Star size={12} className="text-amber-400 fill-amber-400" aria-hidden /> Template Favorit
                </p>
                <p className="text-xs text-muted">{templates.length}/8 · klik untuk order cepat</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {templates.map((t) => (
                  <div key={t.productId} className="relative group">
                    <button
                      onClick={() => jumpToTemplate(t)}
                      className="card card-hover w-full p-3 text-left flex flex-col gap-1.5 min-h-[112px]"
                    >
                      <span className="text-xs uppercase tracking-widest text-muted">{t.serviceCode}</span>
                      <span className="text-sm font-semibold leading-snug">
                        {t.serviceName} · {t.countryEmoji} {t.countryName}
                      </span>
                      <span className="text-xs text-muted truncate">{t.operatorName}</span>
                      <span className="text-sm font-bold tabular-nums mt-auto">{formatIDR(t.price)}</span>
                    </button>
                    <button
                      onClick={() => {
                        removeTemplate(t.productId)
                        refreshTemplates()
                        toast.success('Template dihapus.')
                      }}
                      aria-label={`Hapus template ${t.serviceName}`}
                      title="Hapus dari favorit"
                      className="absolute top-2 right-2 p-1.5 rounded-lg text-muted hover:text-rose-300 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!query.trim() && recentOrders.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="Order terakhir">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-muted flex items-center gap-2">
                  <History size={12} aria-hidden /> Order Terakhir
                </p>
                <p className="text-xs text-muted">klik untuk order ulang (tier yang sama)</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {recentOrders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setReorderTarget(o)}
                    title={`Order ulang #${o.id}`}
                    className="card card-hover shrink-0 flex items-center gap-2.5 px-3 py-2 text-left"
                  >
                    <span className="text-xs font-bold text-indigo-300">{o.status === 'OTP_RECEIVED' || o.status === 'ACTIVE' ? 'aktif' : 'terakhir'}</span>
                    <span className="text-xs text-muted font-mono">#{o.id}</span>
                    <span className="text-xs tabular-nums">{o.amount != null ? formatIDR(o.amount) : '—'}</span>
                    <span className="text-xs text-muted">{o.operator_name ?? 'Any'}</span>
                    <Plus size={12} className="text-indigo-300" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          )}
          {query.trim() ? (
            filteredServices.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {filteredServices.map((s) => (
                  <ServiceCard key={s.id} service={s} onPick={(picked) => { setService(picked); setStep('country'); setQuery('') }} />
                ))}
              </div>
            ) : (
              <EmptyState icon={PackageSearch} title="Tidak ada layanan cocok" description={`Tidak ada layanan bernama “${query.trim()}”. Coba kata kunci lain.`} />
            )
          ) : servicesQuery.isLoading ? (
            <SkeletonGrid count={10} />
          ) : servicesQuery.isError ? (
            <ErrorPanel onRetry={() => void servicesQuery.refetch()} />
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Populer di SMSCode</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {popular.map(({ entry, service: popularService }) => (
                  <PopularCard
                    key={entry.key}
                    name={popularService.name}
                    blurb={entry.blurb}
                    icon={entry.icon}
                    onPick={() => { setService(popularService); setStep('country') }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted mt-1">
                <CircleHelp size={12} aria-hidden />
                Stok & harga ditentukan per negara. Layanan di atas adalah yang paling sering dipakai.
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Langkah 2: Negara ───────────────────────────────────────────── */}
      {step === 'country' && (
        <section className="flex flex-col gap-4">
          <SearchBox value={query} onChange={setQuery} placeholder="Cari negara… mis. Indonesia, +62" autoFocus={AUTO_FOCUS} />
          {countriesQuery.isLoading ? (
            <Spinner label="Memuat daftar negara…" />
          ) : countriesQuery.isError ? (
            <ErrorPanel onRetry={() => void countriesQuery.refetch()} />
          ) : filteredCountries.length === 0 ? (
            <EmptyState icon={Globe2} title="Tidak ada negara cocok" description="Coba kata kunci lain atau kode panggilan, mis. +62." />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredCountries.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCountry(c); setStep('operator'); setQuery('') }}
                    className="card card-hover flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-2xl leading-none" aria-hidden>{c.emoji ?? '🏳️'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{c.name}</span>
                      <span className="block text-xs text-muted font-mono">+{c.dial_code.replace(/^\+/, '')}</span>
                    </span>
                    <ChevronRight size={15} className="text-muted shrink-0" aria-hidden />
                  </button>
                ))}
              </div>
              {!query.trim() && activeCountries.length > 10 && (
                <p className="text-xs text-muted">
                  Menampilkan 10 dari {activeCountries.length} negara — ketik di kolom pencarian untuk mencari negara lainnya.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Langkah 3: Operator ─────────────────────────────────────────── */}
      {step === 'operator' && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted">Pilih operator untuk <span className="text-[var(--color-text)] font-medium">{service?.name} · {country?.emoji} {country?.name}</span></p>
            <button
              onClick={() => { setOperator('any'); setStep('products') }}
              className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 underline underline-offset-4 decoration-indigo-500/40"
            >
              Lewati — gunakan Any
            </button>
          </div>
          {operatorsQuery.isLoading ? (
            <Spinner label="Memuat operator…" />
          ) : operatorsQuery.isError ? (
            <ErrorPanel onRetry={() => void operatorsQuery.refetch()} />
          ) : operatorsQuery.data && operatorsQuery.data.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {operatorsQuery.data.map((op) => {
                const isAny = op.operator_id === null || op.code.toLowerCase() === 'any'
                return (
                  <button
                    key={op.operator_id ?? 'any'}
                    onClick={() => { setOperator(isAny ? 'any' : op); setStep('products') }}
                    className="card card-hover flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                      <Signal size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{op.local_name ?? op.name}</span>
                      <span className="block text-xs uppercase tracking-widest text-muted">{isAny ? 'Semua jaringan' : op.code}</span>
                    </span>
                    <ChevronRight size={15} className="text-muted shrink-0" aria-hidden />
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Signal}
              title="Tidak ada operator khusus"
              description="Kombinasi layanan + negara ini hanya tersedia sebagai tier “Any” (operator mana pun)."
              action={<Button onClick={() => { setOperator('any'); setStep('products') }}>Lanjutkan dengan Any</Button>}
            />
          )}
        </section>
      )}

      {/* ── Langkah 4: Harga & Order ────────────────────────────────────── */}
      {step === 'products' && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted">
              Harga untuk <span className="text-[var(--color-text)] font-medium">{country?.emoji} {country?.name}</span> · <span className="text-[var(--color-text)] font-medium">{operatorLabel}</span>
            </p>
            <button
              onClick={() => void productsQuery.refetch()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-[var(--color-text)]"
            >
              <RotateCw size={13} className={productsQuery.isFetching ? 'animate-spin' : ''} aria-hidden />
              Muat ulang stok
            </button>
          </div>
          {productsQuery.isLoading ? (
            <Spinner label="Memuat daftar harga…" />
          ) : productsQuery.isError ? (
            <ErrorPanel onRetry={() => void productsQuery.refetch()} />
          ) : !productsQuery.data || productsQuery.data.length === 0 ? (
            <EmptyState
              icon={ListOrdered}
              title="Tidak ada stok"
              description="Stok untuk kombinasi ini sedang kosong. Coba operator lain atau muat ulang beberapa saat lagi."
              action={<Button variant="outline" onClick={() => resetTo('operator')}><ArrowLeft size={15} aria-hidden /> Pilih operator lain</Button>}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted border-b border-line">
                      <th className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">Stok</th>
                      <th className="px-3 sm:px-4 py-3 font-medium text-right whitespace-nowrap">Harga</th>
                      <th className="px-3 sm:px-4 py-3 font-medium text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsQuery.data.slice(0, visibleProducts).map((product, index) => (
                    <tr key={product.id} className="border-b border-line last:border-0 align-middle">
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap"><StockBadge available={product.available} /></td>
                      <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-bold tabular-nums">{formatIDR(product.price)}</span>
                        {index === 0 && <span className="block text-xs text-emerald-400 font-semibold mt-0.5">Termurah</span>}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => toggleFavoriteProduct(product)}
                            aria-pressed={templates.some((t) => t.productId === product.id)}
                            title={templates.some((t) => t.productId === product.id) ? 'Hapus dari Template Favorit' : 'Simpan ke Template Favorit'}
                            aria-label="Toggle template favorit"
                            className="p-2 rounded-lg text-muted hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
                          >
                            <Star
                              size={16}
                              aria-hidden
                              className={templates.some((t) => t.productId === product.id) ? 'fill-amber-400 text-amber-400' : ''}
                            />
                          </button>
                          <Button size="sm" onClick={() => setOrderProduct(product)}>Order</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {(() => {
                const total = productsQuery.data.length
                const shown = Math.min(visibleProducts, total)
                return (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted">Menampilkan {shown} dari {total} opsi (termurah dulu).</p>
                    {visibleProducts < total && (
                      <Button variant="outline" size="sm" onClick={() => setVisibleProducts((n) => n + 5)}>
                        Muat lebih banyak (+5)
                      </Button>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {/* ── Dialog konfirmasi order ─────────────────────────────────────── */}
      {orderProduct && (
        <OrderDialog
          product={orderProduct}
          serviceName={service?.name ?? '—'}
          countryName={country?.name ?? '—'}
          operatorLabel={operatorLabel}
          balance={balanceQuery.data?.balance}
          onClose={() => setOrderProduct(null)}
          onOrdered={() => {
            setOrderProduct(null)
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            void queryClient.invalidateQueries({ queryKey: ['orders', 'history'] })
            refresh() // snapshot poller di-update sekarang juga
            navigate('/aktif')
          }}
        />
      )}

      {/* Dialog Order Baru kembali dari "Order Terakhir" */}
      {reorderTarget && (
        <ReorderDialog
          order={reorderTarget}
          onClose={() => setReorderTarget(null)}
          onDone={() => {
            setReorderTarget(null)
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            void queryClient.invalidateQueries({ queryKey: ['orders', 'history'] })
            refresh()
            navigate('/aktif')
          }}
        />
      )}
    </div>
  )
}

// ── Sub-komponen ──────────────────────────────────────────────────────────────

function operatorKey(choice: OperatorChoice): string {
  if (choice === null) return 'none'
  if (choice === 'any') return 'any'
  return String(choice.operator_id ?? 'any')
}

function CrumbButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1 rounded-full hover:bg-[var(--color-panel-2)] text-[var(--color-text)] transition-colors">
      {label}
    </button>
  )
}

function SearchBox({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <Input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 pl-10 text-sm rounded-2xl"
      />
    </div>
  )
}

function ServiceCard({ service, onPick }: { service: Service; onPick: (s: Service) => void }) {
  return (
    <button onClick={() => onPick(service)} className="card card-hover p-4 flex flex-col items-start gap-2 text-left">
      <span className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300">
        {service.name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="text-[13px] font-semibold leading-snug line-clamp-2">{service.name}</span>
      <span className="text-xs uppercase tracking-widest text-muted">{service.code}</span>
    </button>
  )
}

function PopularCard({
  name,
  blurb,
  icon: Icon,
  onPick,
}: {
  name: string
  blurb: string
  icon: LucideIcon,
  onPick: () => void
}) {
  return (
    <button onClick={onPick} className="card card-hover p-4 flex flex-col items-start gap-2.5 text-left group">
      <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/25 to-emerald-400/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 group-hover:text-indigo-200 transition-colors">
        <Icon size={20} aria-hidden />
      </span>
      <span className="text-sm font-semibold leading-snug">{name}</span>
      <span className="text-xs text-muted">{blurb}</span>
    </button>
  )
}

function StockBadge({ available }: { available: number }) {
  if (available <= 0) return <Badge tone="danger">Habis</Badge>
  if (available <= 10) return <Badge tone="warn">{formatNumber(available)} tersisa</Badge>
  return <Badge tone="ok">{formatNumber(available)} stok</Badge>
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card px-6 py-8 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted max-w-sm">Gagal memuat data dari SMSCode. Periksa koneksi internet, lalu coba lagi.</p>
      <Button variant="outline" onClick={onRetry}><RotateCw size={15} aria-hidden /> Coba lagi</Button>
    </div>
  )
}

function OrderDialog({
  product,
  serviceName,
  countryName,
  operatorLabel,
  balance,
  onClose,
  onOrdered,
}: {
  product: Product
  serviceName: string
  countryName: string
  operatorLabel: string
  balance: number | undefined
  onClose: () => void
  onOrdered: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const keyRef = useRef<string>(newIdempotencyKey())

  // Idempotency-Key dibuat SEKALI per dialog — retry wajib memakai key yang sama.
  useEffect(() => {
    keyRef.current = newIdempotencyKey()
    setError(null)
  }, [product.id])

  const mutation = useMutation({
    // Order tier-slot PERSIS yang dipilih — harga sesuai daftar, bukan hasil
    // routing umbrella (catalog_product_id) yang bisa memilih tier lebih murah.
    mutationFn: () =>
      createOrderWithRetry({
        product_id: product.id,
        quantity: 1,
        idempotencyKey: keyRef.current,
      }),
    onSuccess: (result) => {
      const order = result.orders[0]
      if (result.failed_count > 0 || !order) {
        toast.warning('Sebagian request gagal dibuat. Periksa riwayat untuk detail.')
      } else {
        toast.success(`Order #${order.id} berhasil dibuat`)
        void announce(
          'orderCreated',
          'Order berhasil dibuat',
          `#${order.id} · ${serviceName} → ${countryName} · ${formatIDR(product.price)}`,
        )
      }
      onOrdered()
    },
    onError: (err) => {
      setError(friendlyError(err))
    },
  })

  const insufficient = balance !== undefined && balance < product.price
  const saldoAfter = balance !== undefined ? balance - product.price : undefined

  return (
    <Modal
      title="Konfirmasi Order"
      subtitle="Saldo Anda akan terpotong setelah order berhasil dibuat."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={insufficient}
          >
            {mutation.isError ? 'Coba lagi' : `Order — ${formatIDR(product.price)}`}
          </Button>
        </>
      }
    >
      <dl className="text-sm">
        <Row label="Layanan" value={serviceName} />
        <Row label="Negara" value={countryName} />
        <Row label="Operator" value={operatorLabel} />
        <Row label="Tier / produk" value={product.name} mono={false} />
        <Row label="Stok" value={`${formatNumber(product.available)} nomor`} />
        <Row label="Harga" value={formatIDR(product.price)} strong />
        <Row
          label="Saldo setelah order"
          value={saldoAfter !== undefined ? formatIDR(saldoAfter) : '…'}
          danger={saldoAfter !== undefined && saldoAfter < 0}
        />
      </dl>

      {/* Tier persis yang dipilih */}
      <div className="mt-4 rounded-xl border border-line bg-[var(--color-panel-2)]/40 px-4 py-3 text-xs text-muted leading-relaxed">
        Tier yang diklik dipesan langsung via <code className="font-mono text-[var(--color-text)]">product_id</code> — harga persis seperti daftar.
        Kalau stok tier ini habis, order ditolak (tanpa dikenakan biaya), bukan diganti tier lain yang lebih murah.
      </div>

      {insufficient && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 leading-relaxed">
          <p className="font-semibold">Saldo tidak cukup.</p>
          <p className="mt-1">Pesanan ini butuh {formatIDR(product.price)} tapi saldo Anda {formatIDR(balance!)}.</p>
          <button
            className="mt-2 font-semibold underline underline-offset-2 hover:text-amber-200"
            onClick={() => void openUrl('https://smscode.gg')}
          >
            Isi saldo via dashboard SMSCode
          </button>
        </div>
      )}

      {error && !insufficient && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 leading-relaxed">
          <p>{error}</p>
          <p className="mt-1 text-rose-300/60">Percobaan ulang memakai kunci idempotensi yang sama — aman dari dobel debit.</p>
        </div>
      )}
    </Modal>
  )
}

function Row({
  label,
  value,
  strong,
  mono,
  danger,
}: {
  label: string
  value: string
  strong?: boolean
  mono?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1.5 border-b border-line last:border-0">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className={clsx('text-right text-[13px]', strong && 'font-bold', mono && 'font-mono', danger && 'text-rose-400 font-semibold')}>
        {value}
      </dd>
    </div>
  )
}


