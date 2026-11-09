//! Log file ringan (append-only, rotasi 1 generasi) — untuk diagnosis tanpa harus
//! menjalankan dari terminal. Lokasi: $XDG_DATA_HOME/smscode-desktop/logs/app.log
//! (fallback ~/.local/share/smscode-desktop/logs/app.log). Gagal menulis = diam.
use std::io::Write;
use std::path::PathBuf;

const MAX_BYTES: u64 = 512 * 1024;

fn log_dir() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
        })?;
    Some(base.join("smscode-desktop/logs"))
}

pub fn append(level: &str, message: &str) {
    let Some(dir) = log_dir() else { return };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("app.log");
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > MAX_BYTES {
            let _ = std::fs::rename(&path, dir.join("app.log.1"));
        }
    }
    let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    else {
        return;
    };
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let _ = writeln!(file, "{ts} [{level}] {message}");
}
