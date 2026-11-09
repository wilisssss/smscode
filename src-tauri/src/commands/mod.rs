//! Tauri commands — jembatan tipis antara frontend dan `api::Client`.
//! Tidak ada business logic; validasi ringan (exactly-one-of, rentang angka)
//! saja. Semua error keluar sebagai `CommandError` ({ code, message, retryAfter? }).
//! Dipecah per domain: `catalog`, `orders`, `token`, `misc`.

pub mod catalog;
pub mod misc;
pub mod orders;
pub mod token;

pub use catalog::*;
pub use misc::*;
pub use orders::*;
pub use token::*;

use crate::api::client::Client;
use crate::api::error::CommandError;
use crate::keyring;

pub(crate) fn client() -> Result<Client, CommandError> {
    Ok(Client::new(keyring::required()?))
}
