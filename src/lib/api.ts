// Wrapper tipis di atas Tauri `invoke`. Semua network traffic terjadi di Rust;
// frontend tidak pernah memegang token.
import { invoke } from '@tauri-apps/api/core'
import type {
  Balance,
  CancelResult,
  CommandError,
  Country,
  CreateOrderResult,
  FinishResult,
  Operator,
  Order,
  Product,
  ReactivateOptions,
  ResendResult,
  Service,
} from './types'

function asCommandError(err: unknown): CommandError {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    return err as CommandError
  }
  return { code: 'UNKNOWN', message: typeof err === 'string' ? err : 'Terjadi kesalahan tidak dikenal.' }
}

export function isCommandError(err: unknown): err is CommandError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  )
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (err) {
    throw asCommandError(err)
  }
}

/** Idempotency-Key: A–Z a–z 0–9 `_` `-`, ≤ 128 karakter. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

// ── Token / koneksi ──────────────────────────────────────────────────────────
export const hasToken = () => call<boolean>('has_token')
export const saveToken = (token: string) => call<void>('save_token', { token })
export const clearToken = () => call<void>('clear_token')
export const testConnection = () => call<Balance>('test_connection')

// ── Catalog & akun ───────────────────────────────────────────────────────────
export const getBalance = () => call<Balance>('get_balance')
export const listCountries = () => call<Country[]>('list_countries')
export const listServices = (countryId?: number) =>
  call<Service[]>('list_services', { countryId: countryId ?? null })
export const listOperators = (countryId: number, platformId: number) =>
  call<Operator[]>('list_operators', { countryId, platformId })
/** operatorId undefined = tier "Any". */
export const listProducts = (countryId: number, platformId: number, operatorId?: number) =>
  call<Product[]>('list_products', { countryId, platformId, operatorId: operatorId ?? null })

// ── Orders ───────────────────────────────────────────────────────────────────
export const listOrders = (limit: number, offset = 0, status?: string) =>
  call<Order[]>('list_orders', { limit, offset, status: status ?? null })
export const getOrder = (id: number) => call<Order>('get_order', { id })

export interface CreateOrderInput {
  catalog_product_id?: number
  product_id?: number
  operator_id?: number
  max_price?: number
  policy?: 'cheapest' | 'best_success'
  quantity: number
  idempotencyKey: string
}

export const createOrder = (input: CreateOrderInput) =>
  call<CreateOrderResult>('create_order', {
    productId: input.product_id ?? null,
    catalogProductId: input.catalog_product_id ?? null,
    operatorId: input.operator_id ?? null,
    maxPrice: input.max_price ?? null,
    policy: input.policy ?? null,
    quantity: input.quantity,
    idempotencyKey: input.idempotencyKey,
  })

/**
 * create + 1 retry otomatis untuk kegagalan TRANSIENT (network/timeout/5xx/proses masih settling).
 * Retry memakai Idempotency-Key yang SAMA — tidak ada risiko dobel debit.
 * Error non-transient (VALIDATION_ERROR, INSUFFICIENT_BALANCE, ...) langsung dilempar.
 */
const TRANSIENT_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
  'DECODE_ERROR',
  'REQUEST_IN_PROGRESS',
])

export async function createOrderWithRetry(
  input: CreateOrderInput,
  attempts = 2,
): Promise<CreateOrderResult> {
  let lastErr: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await createOrder(input)
    } catch (err) {
      lastErr = err
      const code = isCommandError(err) ? err.code : ''
      const transient =
        TRANSIENT_CODES.has(code) || /^HTTP_5/.test(code) || code === 'HTTP_200'
      if (!transient || attempt === attempts - 1) throw err
      await new Promise((resolve) =>
        setTimeout(resolve, code === 'REQUEST_IN_PROGRESS' ? 2000 : 1200),
      )
    }
  }
  throw lastErr
}

export const cancelOrder = (id: number) => call<CancelResult>('cancel_order', { id })
export const finishOrder = (id: number) => call<FinishResult>('finish_order', { id })
export const resendOrder = (id: number) => call<ResendResult>('resend_order', { id })
export const reactivateOptions = (id: number) => call<ReactivateOptions>('reactivate_options', { id })
export const reactivateOrder = (id: number, maxPrice: number | undefined, idempotencyKey: string) =>
  call<CreateOrderResult>('reactivate_order', { id, maxPrice: maxPrice ?? null, idempotencyKey })


