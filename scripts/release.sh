#!/usr/bin/env bash
# Rilis SMSCode Desktop untuk Arch Linux:
#   1) bump versi ke semua file (package.json, tauri.conf.json, Cargo.toml/lock, PKGBUILD)
#   2) tarball source bersih (tanpa node_modules/dist/target/gen/build artifacts)
#   3) sha256sum → patch PKGBUILD
#   4) makepkg -c  →  smscode-desktop-<ver>-1-x86_64.pkg.tar.zst
#   5) opsional: --install  →  sudo pacman -U hasil.pkg.tar.zst
#
# usage:
#   scripts/release.sh 1.0.1             # build paket saja
#   scripts/release.sh 1.0.1 --install   # build + install via pacman
set -euo pipefail

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 <x.y.z> [--install]" >&2
  exit 1
fi
INSTALL=0
[[ "${2:-}" == "--install" ]] && INSTALL=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT/packaging"
TARBALL="smscode-desktop-${VERSION}.tar.gz"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> 1/4 bump versi → $VERSION"
"$ROOT/scripts/bump-version.sh" "$VERSION"

echo "==> 2/4 buat tarball source"
tar -czf "$WORKDIR/$TARBALL" \
  --exclude='smscode/node_modules' \
  --exclude='smscode/dist' \
  --exclude='smscode/src-tauri/target' \
  --exclude='smscode/src-tauri/gen' \
  --exclude='smscode/packaging/pkg' \
  --exclude='smscode/packaging/src' \
  --exclude='smscode/packaging/*.tar.gz' \
  --exclude='smscode/packaging/*.pkg.tar.zst' \
  --transform "s|^smscode|smscode-desktop-${VERSION}|" \
  -C "$ROOT/.." smscode
mv "$WORKDIR/$TARBALL" "$PKG_DIR/"
# bersihkan artefak rilis lama (paket ter-arsip sudah ada versi barunya)
find "$PKG_DIR" -maxdepth 1 -name 'smscode-desktop-*.pkg.tar.zst' -delete
find "$PKG_DIR" -maxdepth 1 -name 'smscode-desktop-*.tar.gz' ! -name "$TARBALL" -delete

echo "==> 3/4 sha256sum → PKGBUILD"
SHA="$(sha256sum "$PKG_DIR/$TARBALL" | cut -d' ' -f1)"
python3 - "$SHA" "$PKG_DIR/PKGBUILD" <<'PY'
import io, re, sys
sha, path = sys.argv[1], sys.argv[2]
s = io.open(path, encoding='utf-8').read()
s = re.sub(r"(?m)^sha256sums=\('[^']*'\)$", f"sha256sums=('{sha}')", s)
io.open(path, 'w', encoding='utf-8').write(s)
PY
echo "    sha256 = $SHA"

echo "==> 4/4 makepkg -c"
cd "$PKG_DIR"
makepkg -c

PKG_FILE="smscode-desktop-${VERSION}-1-x86_64.pkg.tar.zst"
echo "==> selesai: $PKG_DIR/$PKG_FILE"
if [[ "$INSTALL" == 1 ]]; then
  echo "==> install via pacman"
  sudo pacman -U --noconfirm "$PKG_DIR/$PKG_FILE"
else
  echo "    install: sudo pacman -U $PKG_DIR/$PKG_FILE"
fi
