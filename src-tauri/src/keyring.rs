//! Token API — satu-satunya tempat token disimpan.
//!
//! - **Desktop**: Secret Service (gnome-keyring / KWallet / KeePassXC). Tidak
//!   ada fallback ke plaintext; bila daemon tidak tersedia, penyimpanan ditolak.
//! - **Android**: file privat di dalam sandbox aplikasi (`app_data_dir`), mode
//!   0600. Secret Service tidak ada di Android dan crate `keyring` v4 secara
//!   eksplisit menolak platform ini, jadi file privat adalah opsi yang tersedia
//!   (tetap terlindungi enkripsi disk Android + sandbox per-aplikasi).
use crate::api::error::CommandError;

#[cfg(not(target_os = "android"))]
use keyring::Entry;

#[cfg(target_os = "android")]
use std::io::Write;
#[cfg(target_os = "android")]
use tauri::Manager;

const SERVICE: &str = "smscode-desktop";
const ACCOUNT: &str = "api-token";

/// Handle aplikasi untuk jalur penyimpanan Android (diisi sekali saat setup).
#[cfg(target_os = "android")]
static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

/// Dipanggil sekali dari `setup`; no-op di desktop.
pub fn init(app: tauri::AppHandle) {
    #[cfg(target_os = "android")]
    {
        let _ = APP_HANDLE.set(app);
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
    }
}

fn validate(token: &str) -> Result<&str, CommandError> {
    let trimmed = token.trim();
    if trimmed.len() < 8 {
        return Err(CommandError::new(
            "VALIDATION_ERROR",
            "Token terlalu pendek. Salin token persis dari Account Settings di dashboard SMSCode.",
        ));
    }
    Ok(trimmed)
}

/* ───────────────────────── Desktop: Secret Service ───────────────────────── */

#[cfg(not(target_os = "android"))]
fn entry() -> Result<Entry, CommandError> {
    Entry::new(SERVICE, ACCOUNT).map_err(CommandError::from)
}

#[cfg(not(target_os = "android"))]
pub fn save(token: &str) -> Result<(), CommandError> {
    let token = validate(token)?;
    entry()?.set_password(token).map_err(CommandError::from)
}

#[cfg(not(target_os = "android"))]
pub fn get() -> Result<Option<String>, CommandError> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(CommandError::from(err)),
    }
}

#[cfg(not(target_os = "android"))]
pub fn delete() -> Result<(), CommandError> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(CommandError::from(err)),
    }
}

/* ───────────────────────── Android: file privat aplikasi ─────────────────── */

#[cfg(target_os = "android")]
fn io_error(context: &str, err: std::io::Error) -> CommandError {
    CommandError::new("TOKEN_STORE_ERROR", format!("{context}: {err}"))
}

#[cfg(target_os = "android")]
fn token_path() -> Result<std::path::PathBuf, CommandError> {
    let app = APP_HANDLE.get().ok_or_else(|| {
        CommandError::new(
            "TOKEN_STORE_ERROR",
            "Penyimpanan token belum siap; buka ulang aplikasi.",
        )
    })?;
    let dir = app.path().app_data_dir().map_err(|err| {
        CommandError::new(
            "TOKEN_STORE_ERROR",
            format!("Tidak bisa membuka folder data aplikasi: {err}"),
        )
    })?;
    std::fs::create_dir_all(&dir)
        .map_err(|err| io_error("Tidak bisa membuat folder data aplikasi", err))?;
    Ok(dir.join("api-token"))
}

#[cfg(target_os = "android")]
pub fn save(token: &str) -> Result<(), CommandError> {
    let token = validate(token)?;
    let path = token_path()?;
    let mut file =
        std::fs::File::create(&path).map_err(|err| io_error("Gagal menyimpan token", err))?;
    // Hanya pemilik aplikasi yang boleh membaca.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = file.set_permissions(std::fs::Permissions::from_mode(0o600));
    }
    file.write_all(token.as_bytes())
        .map_err(|err| io_error("Gagal menulis token", err))?;
    file.sync_all()
        .map_err(|err| io_error("Gagal menyelesaikan penyimpanan token", err))
}

#[cfg(target_os = "android")]
pub fn get() -> Result<Option<String>, CommandError> {
    let path = token_path()?;
    match std::fs::read_to_string(&path) {
        Ok(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(trimmed.to_string()))
            }
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(io_error("Gagal membaca token", err)),
    }
}

#[cfg(target_os = "android")]
pub fn delete() -> Result<(), CommandError> {
    let path = token_path()?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(io_error("Gagal menghapus token", err)),
    }
}

/// Ambil token atau gagal dengan `NO_TOKEN` (dipakai semua command network).
pub fn required() -> Result<String, CommandError> {
    get()?.ok_or_else(|| {
        CommandError::new("NO_TOKEN", "Token API belum disimpan. Atur di Pengaturan.")
    })
}
