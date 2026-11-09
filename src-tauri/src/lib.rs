mod api;
mod commands;
mod keyring;
mod log;
mod poller;

use std::sync::{Arc, Mutex};

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Autostart tidak tersedia di Android/iOS.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        None,
    ));

    builder
        .setup(|app| {
            // Penyimpanan token Android butuh path data aplikasi.
            keyring::init(app.handle().clone());
            // Polling order di Rust; webview menerima event `orders-updated`.
            let snapshot: poller::Snapshot = Arc::new(Mutex::new(None));
            let notify: poller::RefreshNotify = Arc::new(tokio::sync::Notify::new());
            app.manage(snapshot.clone());
            app.manage(notify.clone());
            poller::spawn(app.handle().clone(), snapshot, notify);
            Ok(())
        })
        // Tutup window = keluar dari aplikasi (tidak ada tray / minimize ke tray).
        .invoke_handler(tauri::generate_handler![
            commands::has_token,
            commands::save_token,
            commands::clear_token,
            commands::test_connection,
            commands::get_balance,
            commands::list_countries,
            commands::list_services,
            commands::list_operators,
            commands::list_products,
            commands::list_orders,
            commands::get_order,
            commands::create_order,
            commands::cancel_order,
            commands::finish_order,
            commands::resend_order,
            commands::reactivate_options,
            commands::reactivate_order,
            commands::get_orders_snapshot,
            commands::refresh_orders,
            commands::set_poll_interval,
            commands::play_system_sound,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
