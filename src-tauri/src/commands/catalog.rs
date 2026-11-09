//! Catalog + saldo (semua operasi baca, tanpa efek samping).

use crate::api::error::CommandError;
use crate::api::types::*;

use super::client;

#[tauri::command]
pub async fn get_balance() -> Result<Balance, CommandError> {
    client()?.balance().await
}

#[tauri::command]
pub async fn list_countries() -> Result<Vec<Country>, CommandError> {
    client()?.countries().await
}

#[tauri::command]
pub async fn list_services(country_id: Option<i64>) -> Result<Vec<Service>, CommandError> {
    client()?.services(country_id).await
}

#[tauri::command]
pub async fn list_operators(
    country_id: i64,
    platform_id: i64,
) -> Result<Vec<Operator>, CommandError> {
    client()?.operators(country_id, platform_id).await
}

#[tauri::command]
pub async fn list_products(
    country_id: i64,
    platform_id: i64,
    operator_id: Option<i64>,
) -> Result<Vec<Product>, CommandError> {
    client()?
        .products(country_id, platform_id, operator_id)
        .await
}
