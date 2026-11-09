use serde::Serialize;

/// Error tunggal untuk semua Tauri commands. Dikomunikasikan ke frontend
/// sebagai JSON `{ code, message, retryAfter? }` — frontend branch pada `code`,
/// tidak pernah pada `message` (sesuai panduan integrasi SMSCode).
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retry_after: None,
        }
    }

    pub fn with_retry(self, retry_after: Option<u64>) -> Self {
        Self {
            retry_after,
            ..self
        }
    }
}

impl From<reqwest::Error> for CommandError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            return Self::new(
                "TIMEOUT",
                "Koneksi ke api.smscode.gg melebihi batas waktu. Coba lagi.",
            );
        }
        if err.is_connect() {
            return Self::new(
                "NETWORK_ERROR",
                "Tidak dapat terhubung ke api.smscode.gg. Periksa koneksi internet Anda.",
            );
        }
        Self::new("NETWORK_ERROR", format!("Kesalahan jaringan: {err}"))
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(err: serde_json::Error) -> Self {
        Self::new(
            "DECODE_ERROR",
            format!("Respons API tidak dapat dibaca: {err}"),
        )
    }
}

impl From<keyring::Error> for CommandError {
    fn from(err: keyring::Error) -> Self {
        match err {
            keyring::Error::NoEntry => Self::new("NO_TOKEN", "Token API belum disimpan."),
            other => Self::new(
                "KEYRING_UNAVAILABLE",
                format!("Secret Service (mis. gnome-keyring) tidak tersedia atau menolak akses: {other}"),
            ),
        }
    }
}
