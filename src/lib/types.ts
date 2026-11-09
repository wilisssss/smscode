// Mirror persis dari tipe Rust di src-tauri/src/api/types.rs (snake_case).
// Money = integer IDR.
export interface Balance {
  currency: string
  balance: number
}

export interface Country {
  id: number
  code: string
  name: string
  dial_code: string
  emoji: string | null
  active: boolean
}

export interface Service {
  id: number
  code: string
  name: string
  active: boolean
}

export interface Operator {
  /** null = opsi sintetik "Any". */
  operator_id: number | null
  code: string
  name: string
  local_name: string | null
}

export interface Product {
  id: number
  name: string
  country_id: number
  platform_id: number
  catalog_product_id: number | null
  operator_id: number | null
  operator_name: string | null
  available: number
  /** IDR, integer. */
  price: number
  active: boolean
}

export type OrderStatus =
  | 'ACTIVE'
  | 'OTP_RECEIVED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'EXPIRED'

export interface Order {
  id: number
  status: string
  created_at: string | null
  product_id: number | null
  catalog_product_id: number | null
  operator_id: number | null
  operator_name: string | null
  phone_number: string | null
  amount: number | null
  otp_code: string | null
  otp_message: string | null
  sms_revision: number | null
  otp_received_at: string | null
  expires_at: string | null
  canceled_at: string | null
  failed_reason: string | null
  can_finish: boolean
  can_resend: boolean
  can_cancel: boolean
  can_replace: boolean
  can_reactivate: boolean
  resend_available_at: string | null
  cancel_available_at: string | null
  replace_available_at: string | null
  resend_mode: string | null
}

export interface CreateOrderResult {
  orders: Order[]
  failed_count: number
}

export interface CancelResult {
  order_id: number
  status: string
  refund_amount: number | null
  new_balance: number | null
}

export interface FinishResult {
  order_id: number
  status: string
}

export interface ResendResult {
  order_id: number
  status: string
  resent: boolean
}

export interface ReactivateOptions {
  /** IDR, integer. */
  cost: number
}

/** Kontrak error dari backend (lihat src-tauri/src/api/error.rs). */
export interface CommandError {
  code: string
  message: string
  retry_after?: number
}
