//! Loop polling order di sisi Rust — satu-satunya sumber polling.
//! Webview TIDAK punya timer JS untuk data order; ia hanya mendengarkan
//! event `orders-updated` (payload: array order) dan `orders-error`
//! (payload: `{ code, message }`) yang di-emit saat data berubah / gagal.
//! Poller mentolerir kegagalan transient: 2 upaya per tick (jeda 800 ms);
//! error ke UI hanya muncul setelah 3 gagal berturut-turut.
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use tokio::sync::Notify;
use tokio::time::sleep;

use crate::api::client::Client;
use crate::api::types::Order;
use crate::keyring;

pub type Snapshot = Arc<Mutex<Option<Vec<Order>>>>;
pub type RefreshNotify = Arc<Notify>;

/// Jeda polling bawaan: 4 detik (bisa diubah dari Pengaturan).
pub const DEFAULT_POLL_INTERVAL_SECS: u64 = 4;
pub const MIN_POLL_INTERVAL_SECS: u64 = 2;
pub const MAX_POLL_INTERVAL_SECS: u64 = 60;

static POLL_INTERVAL_SECS: AtomicU64 = AtomicU64::new(DEFAULT_POLL_INTERVAL_SECS);

/// Atur jeda polling (detik). Nilai di-clamp ke rentang aman; mengembalikan nilai final.
pub fn set_interval_secs(seconds: u64) -> u64 {
    let clamped = seconds.clamp(MIN_POLL_INTERVAL_SECS, MAX_POLL_INTERVAL_SECS);
    POLL_INTERVAL_SECS.store(clamped, Ordering::Relaxed);
    clamped
}

pub fn interval_secs() -> u64 {
    POLL_INTERVAL_SECS.load(Ordering::Relaxed)
}
/// Gagal berturut-turut sebelum error ditampilkan ke UI (transient disembunyikan).
const FAILURE_THRESHOLD: u32 = 3;

/// Error permanen: token ditolak dll. — langsung tampilkan, bulan tidak retry-sia-sia.
fn is_permanent(code: &str) -> bool {
    matches!(
        code,
        "UNAUTHORIZED" | "FORBIDDEN" | "NO_TOKEN" | "VALIDATION_ERROR" | "IDEMPOTENCY_KEY_REUSED"
    )
}

pub fn spawn(app: AppHandle, snapshot: Snapshot, notify: RefreshNotify) {
    tauri::async_runtime::spawn(async move { run(app, snapshot, notify).await });
}

async fn run(app: AppHandle, snapshot: Snapshot, notify: RefreshNotify) {
    let mut previous: Option<Vec<Order>> = None;
    let mut failures: u32 = 0;
    // Client (koneksi TLS) dipakai ulang; hanya dibuat ulang bila token berubah.
    let mut cached: Option<(String, Client)> = None;
    // Poll pertama langsung; jeda berikutnya dibaca ulang dari pengaturan.
    let mut wait = Duration::ZERO;

    loop {
        tokio::select! {
            _ = sleep(wait) => {}
            _ = notify.notified() => {}
        }
        wait = Duration::from_secs(interval_secs());

        // Belum ada token (atau keyring bermasalah) → jangan hit API sama sekali.
        let token = match keyring::get() {
            Ok(Some(token)) => token,
            _ => continue,
        };
        if cached.as_ref().map(|(t, _)| t) != Some(&token) {
            cached = Some((token.clone(), Client::new(token)));
        }
        let client = &cached.as_ref().expect("client cache terisi").1;

        // Maks 2 upaya per tick — kegagalan sementara ditoleransi diam-diam.
        let mut fetched: Result<Vec<Order>, crate::api::error::CommandError> = Err(
            crate::api::error::CommandError::new("NETWORK_ERROR", "unknown"),
        );
        for attempt in 0..2 {
            fetched = client.list_orders(20, 0, None).await;
            if fetched.is_ok() {
                break;
            }
            if attempt == 0 {
                sleep(Duration::from_millis(800)).await;
            }
        }

        match fetched {
            Ok(orders) => {
                failures = 0;
                let changed = previous.as_ref() != Some(&orders);
                previous = Some(orders.clone());
                if let Ok(mut guard) = snapshot.lock() {
                    *guard = Some(orders.clone());
                }
                if changed {
                    let _ = app.emit("orders-updated", &orders);
                } else {
                    // Heartbeat ringan agar UI tahu app masih sinkron (dan refresh selesai).
                    let _ = app.emit("orders-heartbeat", ());
                }
            }
            Err(err) => {
                crate::log::append(
                    "poll",
                    &format!("poll gagal: {} — {}", err.code, err.message),
                );
                // Error permanen (token ditolak dll.) langsung tampil ke UI,
                // tidak perlu menunggu ambang kegagalan.
                if is_permanent(&err.code) {
                    let _ = app.emit(
                        "orders-error",
                        serde_json::json!({ "code": err.code, "message": err.message }),
                    );
                } else {
                    failures += 1;
                    if failures >= FAILURE_THRESHOLD {
                        let _ = app.emit(
                            "orders-error",
                            serde_json::json!({ "code": err.code, "message": err.message }),
                        );
                    }
                }
            }
        }
    }
}
