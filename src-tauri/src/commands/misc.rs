//! Lain-lain: sound sistem (bebas dari pembatasan autoplay webview).

/// Mainkan sound freedesktop lewat `canberra-gtk-play` (bawaan libcanberra,
/// dependensi gtk3). Hanya nama dari whitelist yang diterima — mengembalikan
/// `false` bila binary tidak tersedia atau nama tidak valid (pemanggil boleh
/// fallback ke Web Audio).
#[tauri::command]
pub fn play_system_sound(name: String) -> bool {
    const ALLOWED: [&str; 5] = [
        "message-new-instant",
        "dialog-information",
        "complete",
        "bell",
        "dialog-warning",
    ];
    if !ALLOWED.contains(&name.as_str()) {
        return false;
    }
    // Spawn lalu reap di thread terpisah — kalau tidak, proses ini jadi zombie.
    match std::process::Command::new("canberra-gtk-play")
        .arg("-i")
        .arg(name)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(child) => {
            std::thread::spawn(move || {
                let _ = child.wait_with_output();
            });
            true
        }
        Err(_) => false,
    }
}
