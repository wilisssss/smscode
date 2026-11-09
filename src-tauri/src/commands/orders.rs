//! Orders: baca, buat, dan aksi (cancel/finish/resend/reactivate) + snapshot poller.

use crate::api::error::CommandError;
use crate::api::types::*;

use super::client;

// ── Validasi murni (dipakai command + unit test) ─────────────────────────

pub(crate) fn check_idempotency_key(key: &str) -> Result<(), CommandError> {
    let ok = !key.is_empty()
        && key.len() <= 128
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(())
    } else {
        Err(CommandError::new(
            "VALIDATION_ERROR",
            "Idempotency-Key tidak valid (huruf, angka, '-', '_', maks 128 karakter).",
        ))
    }
}

/// Validasi argumen create_order (sebelum menyentuh jaringan).
/// Mengembalikan request siap kirim atau error VALIDATION_ERROR.
pub(crate) fn validate_create_order_args(
    product_id: Option<i64>,
    catalog_product_id: Option<i64>,
    operator_id: Option<i64>,
    max_price: Option<i64>,
    policy: Option<String>,
    quantity: i64,
) -> Result<CreateOrderRequest, CommandError> {
    if product_id.is_some() == catalog_product_id.is_some() {
        return Err(CommandError::new(
            "VALIDATION_ERROR",
            "Isi salah satu: product_id atau catalog_product_id (tidak boleh keduanya / kosong).",
        ));
    }
    if !(1..=100).contains(&quantity) {
        return Err(CommandError::new(
            "VALIDATION_ERROR",
            "quantity harus antara 1 sampai 100.",
        ));
    }
    if product_id.is_some() && (operator_id.is_some() || max_price.is_some() || policy.is_some()) {
        return Err(CommandError::new(
            "VALIDATION_ERROR",
            "operator_id / max_price / policy hanya berlaku dengan catalog_product_id.",
        ));
    }

    Ok(CreateOrderRequest {
        product_id,
        catalog_product_id,
        operator_id,
        max_price,
        policy,
        quantity,
    })
}

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_orders(
    limit: i64,
    offset: i64,
    status: Option<String>,
) -> Result<Vec<Order>, CommandError> {
    let limit = limit.clamp(1, 100);
    let offset = offset.max(0);
    client()?
        .list_orders(limit, offset, status.as_deref())
        .await
}

#[tauri::command]
pub async fn get_order(id: i64) -> Result<Order, CommandError> {
    client()?.get_order(id).await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_order(
    product_id: Option<i64>,
    catalog_product_id: Option<i64>,
    operator_id: Option<i64>,
    max_price: Option<i64>,
    policy: Option<String>,
    quantity: i64,
    idempotency_key: String,
) -> Result<CreateOrderResult, CommandError> {
    check_idempotency_key(&idempotency_key)?;
    let request = validate_create_order_args(
        product_id,
        catalog_product_id,
        operator_id,
        max_price,
        policy,
        quantity,
    )?;
    client()?.create_order(&request, &idempotency_key).await
}

#[tauri::command]
pub async fn cancel_order(id: i64) -> Result<CancelResult, CommandError> {
    client()?.cancel_order(id).await
}

#[tauri::command]
pub async fn finish_order(id: i64) -> Result<FinishResult, CommandError> {
    client()?.finish_order(id).await
}

#[tauri::command]
pub async fn resend_order(id: i64) -> Result<ResendResult, CommandError> {
    client()?.resend_order(id).await
}

#[tauri::command]
pub async fn reactivate_options(id: i64) -> Result<ReactivateOptions, CommandError> {
    client()?.reactivate_options(id).await
}

#[tauri::command]
pub async fn reactivate_order(
    id: i64,
    max_price: Option<i64>,
    idempotency_key: String,
) -> Result<CreateOrderResult, CommandError> {
    check_idempotency_key(&idempotency_key)?;
    client()?
        .reactivate_order(id, max_price, &idempotency_key)
        .await
}

// ── Snapshot poller ───────────────────────────────────────────────────────

/// Snapshot order terbaru (20 teratas) atau `null` bila belum ada fetch sukses.
#[tauri::command]
pub fn get_orders_snapshot(state: tauri::State<'_, crate::poller::Snapshot>) -> Option<Vec<Order>> {
    state.lock().ok()?.clone()
}

/// Minta poller mengambil data SEKARANG (mis. setelah mutasi, agar UI instan).
#[tauri::command]
pub fn refresh_orders(state: tauri::State<'_, crate::poller::RefreshNotify>) {
    state.notify_one();
}

/// Ubah jeda polling order (detik). Nilai di-clamp ke 2..=60.
#[tauri::command]
pub fn set_poll_interval(
    seconds: u64,
    notify: tauri::State<'_, crate::poller::RefreshNotify>,
) -> u64 {
    let applied = crate::poller::set_interval_secs(seconds);
    // Bangunkan loop poller agar jeda baru langsung berlaku.
    notify.notify_one();
    applied
}

// ── Unit tests (tanpa jaringan) ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── check_idempotency_key ─────────────────────────────────────────────
    #[test]
    fn idempotency_key_valid() {
        assert!(check_idempotency_key("ord_123-ABC_x").is_ok());
        assert!(check_idempotency_key("a").is_ok());
        assert!(check_idempotency_key(&"k".repeat(128)).is_ok());
    }

    #[test]
    fn idempotency_key_invalid() {
        assert!(check_idempotency_key("").is_err());
        assert!(check_idempotency_key(&"k".repeat(129)).is_err());
        assert!(check_idempotency_key("with space").is_err());
        assert!(check_idempotency_key("semi;colon").is_err());
        assert!(check_idempotency_key("titi.s").is_err());
        assert!(check_idempotency_key("unicode-✓").is_err());
    }

    // ── validate_create_order_args ────────────────────────────────────────
    #[test]
    fn exactly_one_of_product_or_catalog() {
        // keduanya → error
        assert!(validate_create_order_args(Some(1), Some(2), None, None, None, 1).is_err());
        // kosong → error
        assert!(validate_create_order_args(None, None, None, None, None, 1).is_err());
        // salah satu → ok
        assert!(validate_create_order_args(Some(142), None, None, None, None, 1).is_ok());
        assert!(validate_create_order_args(None, Some(87), None, None, None, 1).is_ok());
    }

    #[test]
    fn quantity_range_enforced() {
        assert!(validate_create_order_args(Some(1), None, None, None, None, 0).is_err());
        assert!(validate_create_order_args(Some(1), None, None, None, None, 101).is_err());
        assert!(validate_create_order_args(Some(1), None, None, None, None, 1).is_ok());
        assert!(validate_create_order_args(Some(1), None, None, None, None, 100).is_ok());
    }

    #[test]
    fn operator_and_price_cap_only_with_catalog() {
        // product_id + operator → error
        assert!(validate_create_order_args(Some(1), None, Some(433), None, None, 1).is_err());
        // product_id + max_price → error
        assert!(validate_create_order_args(Some(1), None, None, Some(20000), None, 1).is_err());
        // catalog + operator → ok
        assert!(validate_create_order_args(None, Some(87), Some(433), None, None, 1).is_ok());
        // catalog + max_price + policy → ok
        assert!(validate_create_order_args(
            None,
            Some(87),
            None,
            Some(20000),
            Some("cheapest".into()),
            1
        )
        .is_ok());
    }

    #[test]
    fn valid_product_request_shape() {
        let req = validate_create_order_args(Some(142), None, None, None, None, 3).unwrap();
        assert_eq!(req.product_id, Some(142));
        assert_eq!(req.catalog_product_id, None);
        assert_eq!(req.quantity, 3);
    }
}
