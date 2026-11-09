//! Sistem token + tes koneksi. Token HANYA di Secret Service (lihat `keyring`).

use crate::api::error::CommandError;
use crate::api::types::*;
use crate::keyring;

use super::client;

// Mengembalikan `Err` bila Secret Service tidak tersedia (token ada tapi tidak bisa dibaca),
// agar UI bisa membedakan "belum dibuat" vs "keyring bermasalah".
#[tauri::command]
pub fn has_token() -> Result<bool, CommandError> {
    match keyring::get() {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(err) => Err(err),
    }
}

#[tauri::command]
pub fn save_token(token: String) -> Result<(), CommandError> {
    keyring::save(&token)
}

#[tauri::command]
pub fn clear_token() -> Result<(), CommandError> {
    keyring::delete()
}

#[tauri::command]
pub async fn test_connection() -> Result<Balance, CommandError> {
    client()?.balance().await
}
