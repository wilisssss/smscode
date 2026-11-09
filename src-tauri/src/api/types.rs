//! Tipe data mirror persis dari kontrak `/v1` di https://smscode.gg/openapi.yaml.
//! Field tak dikenal pada respons diabaikan secara diam-diam (aturan kompatibilitas API).
//! Money = integer IDR (contoh: 15000 = Rp 15.000).
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Country {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub dial_code: String,
    #[serde(default)]
    pub emoji: Option<String>,
    #[serde(default)]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub id: i64,
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operator {
    /// `null` = opsi sintetik "Any" (operator mana pun yang tersedia).
    pub operator_id: Option<i64>,
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub local_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub country_id: i64,
    pub platform_id: i64,
    #[serde(default)]
    pub catalog_product_id: Option<i64>,
    #[serde(default)]
    pub operator_id: Option<i64>,
    #[serde(default)]
    pub operator_name: Option<String>,
    pub available: i64,
    /// IDR, integer.
    pub price: i64,
    #[serde(default)]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    pub currency: String,
    /// IDR, integer.
    pub balance: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
    pub status: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub product_id: Option<i64>,
    #[serde(default)]
    pub catalog_product_id: Option<i64>,
    #[serde(default)]
    pub operator_id: Option<i64>,
    #[serde(default)]
    pub operator_name: Option<String>,
    #[serde(default)]
    pub phone_number: Option<String>,
    /// IDR, integer. Tidak ada pada endpoint /orders/active.
    #[serde(default)]
    pub amount: Option<i64>,
    #[serde(default)]
    pub otp_code: Option<String>,
    #[serde(default)]
    pub otp_message: Option<String>,
    #[serde(default)]
    pub sms_revision: Option<i64>,
    #[serde(default)]
    pub otp_received_at: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub canceled_at: Option<String>,
    #[serde(default)]
    pub failed_reason: Option<String>,
    // Server-authoritative capability flags.
    #[serde(default)]
    pub can_finish: bool,
    #[serde(default)]
    pub can_resend: bool,
    #[serde(default)]
    pub can_cancel: bool,
    #[serde(default)]
    pub can_replace: bool,
    #[serde(default)]
    pub can_reactivate: bool,
    #[serde(default)]
    pub resend_available_at: Option<String>,
    #[serde(default)]
    pub cancel_available_at: Option<String>,
    #[serde(default)]
    pub replace_available_at: Option<String>,
    /// "manual" = user boleh minta kirim ulang; "auto" = SMS berikutnya datang sendiri.
    #[serde(default)]
    pub resend_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateOrderRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub catalog_product_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operator_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_price: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy: Option<String>,
    pub quantity: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderResult {
    pub orders: Vec<Order>,
    #[serde(default)]
    pub failed_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelResult {
    pub order_id: i64,
    pub status: String,
    #[serde(default)]
    pub refund_amount: Option<i64>,
    #[serde(default)]
    pub new_balance: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinishResult {
    pub order_id: i64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResendResult {
    pub order_id: i64,
    pub status: String,
    #[serde(default)]
    pub resent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactivateOptions {
    /// IDR, integer.
    pub cost: i64,
}
