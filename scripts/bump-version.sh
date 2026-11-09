#!/usr/bin/env bash
# Sinkronkan versi ke SEMUA file yang menyimpannya (sumber tunggal: argumen x.y.z):
#   package.json, package-lock.json, src-tauri/tauri.conf.json,
#   src-tauri/Cargo.toml, src-tauri/Cargo.lock, packaging/PKGBUILD (pkgver, pkgrel direset ke 1)
set -euo pipefail

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 <x.y.z>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - "$VERSION" "$ROOT" <<'PY'
import io, json, re, sys

version, root = sys.argv[1], sys.argv[2]

def write_json(path, data):
    io.open(path, 'w', encoding='utf-8').write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def load_json(path):
    return json.load(io.open(path, encoding='utf-8'))

# 1) package.json
p = f'{root}/package.json'
d = load_json(p); d['version'] = version; write_json(p, d)

# 2) package-lock.json (dua tempat: root "version" dan packages[""].version)
p = f'{root}/package-lock.json'
d = load_json(p); d['version'] = version
if '' in d.get('packages', {}):
    d['packages']['']['version'] = version
write_json(p, d)

# 3) tauri.conf.json
p = f'{root}/src-tauri/tauri.conf.json'
d = load_json(p); d['version'] = version; write_json(p, d)

# 4) Cargo.toml — baris `version = "x.y.z"` pertama (di dalam [package])
p = f'{root}/src-tauri/Cargo.toml'
s = io.open(p, encoding='utf-8').read()
s, n = re.subn(r'(?m)^version = "[^"]+"$', f'version = "{version}"', s, count=1)
assert n == 1, 'Cargo.toml: baris version tidak ditemukan'
io.open(p, 'w', encoding='utf-8').write(s)

# 5) Cargo.lock — entri paket smscode-desktop
p = f'{root}/src-tauri/Cargo.lock'
s = io.open(p, encoding='utf-8').read()
s, n = re.subn(
    r'(\[\[package\]\]\nname = "smscode-desktop"\nversion = )"[^"]+"',
    lambda m: m.group(1) + f'"{version}"',
    s, count=1,
)
assert n == 1, 'Cargo.lock: paket smscode-desktop tidak ditemukan'
io.open(p, 'w', encoding='utf-8').write(s)

# 6) PKGBUILD — pkgver baru + pkgrel=1
p = f'{root}/packaging/PKGBUILD'
s = io.open(p, encoding='utf-8').read()
s = re.sub(r'(?m)^pkgver=.*$', f'pkgver={version}', s)
s = re.sub(r'(?m)^pkgrel=.*$', 'pkgrel=1', s)
io.open(p, 'w', encoding='utf-8').write(s)

print(f'version → {version}')
PY
echo "bump-version selesai."
