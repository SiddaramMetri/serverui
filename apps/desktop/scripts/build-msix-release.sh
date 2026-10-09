#!/usr/bin/env bash
# Build a Microsoft Store-compatible MSIX for ServerUI (Windows x64 host only).
#
# Uses Microsoft's WinApp CLI (winapp pack) around a Tauri release binary + Go sidecar.
# Does not replace NSIS/MSI generation (see build-native-release.sh).
#
# Usage:
#   apps/desktop/scripts/build-msix-release.sh
#   apps/desktop/scripts/build-msix-release.sh local   # self-signed sideload test
#   apps/desktop/scripts/build-msix-release.sh store   # unsigned package for Partner Center
#
# Prerequisites:
#   - Windows host with Git Bash, Node, Go, Rust, WebView2 Evergreen Runtime
#   - winapp CLI: winget install microsoft.winappcli --source winget
#   - For store mode: apps/desktop/msix/store-identity.env (from store-identity.example.env)
#   - For local mode: winapp generates/signs with a matching self-signed cert
#
# Output:
#   dist/msix/ServerUI_<version>_x64.msix
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DESKTOP_DIR="$ROOT/apps/desktop"
MSIX_DIR="$DESKTOP_DIR/msix"
STAGING_DIR="$MSIX_DIR/staging"
IDENTITY_ENV="$MSIX_DIR/store-identity.env"
IDENTITY_EXAMPLE="$MSIX_DIR/store-identity.example.env"
TARGET_DIR="$DESKTOP_DIR/src-tauri/target"
OUT_DIR="$ROOT/dist/msix"
RUST_TRIPLE="x86_64-pc-windows-msvc"

MODE="${1:-}"
if [[ -z "$MODE" ]]; then
  if [[ -f "$IDENTITY_ENV" ]]; then
    MODE="store"
  else
    MODE="local"
  fi
fi

case "$MODE" in
  store|local) ;;
  *)
    echo "Usage: $0 [store|local]" >&2
    exit 1
    ;;
esac

HOST_OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$HOST_OS" in
  mingw*|msys*|cygwin*|windows*) ;;
  *)
    if [[ "${OS:-}" != "Windows_NT" ]]; then
      echo "MSIX packaging must run on Windows (got OS=$(uname -s))." >&2
      exit 1
    fi
    ;;
esac

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    if [[ "$1" == "winapp" ]]; then
      echo "Install with: winget install microsoft.winappcli --source winget" >&2
      echo "Then open a new shell so winapp is on PATH." >&2
    fi
    exit 1
  fi
}

for cmd in go rustc cargo rustup node npm winapp; do
  require_cmd "$cmd"
done

if [[ ! -f "$MSIX_DIR/Package.appxmanifest" ]]; then
  echo "Missing $MSIX_DIR/Package.appxmanifest" >&2
  exit 1
fi

if [[ ! -d "$MSIX_DIR/Assets" ]]; then
  echo "Missing $MSIX_DIR/Assets — regenerate with:" >&2
  echo "  winapp manifest generate apps/desktop/msix --package-name ServerUI \\" >&2
  echo "    --publisher-name CN=Dev --version 0.0.0.0 --entrypoint ServerUI.exe \\" >&2
  echo "    --logo-path branding/serverui-icon-1024.png --template Packaged --if-exists Overwrite" >&2
  exit 1
fi

load_identity() {
  STORE_PACKAGE_IDENTITY_NAME=""
  STORE_PUBLISHER=""
  STORE_PUBLISHER_DISPLAY_NAME="Skyrekon Private Limited"

  if [[ -f "$IDENTITY_ENV" ]]; then
    # shellcheck disable=SC1090
    set -a
    # strip CR for Windows-edited env files
    eval "$(sed 's/\r$//' "$IDENTITY_ENV" | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true)"
    set +a
  fi

  if [[ "$MODE" == "local" ]]; then
    # Local sideload defaults (safe when Partner Center identity is not configured).
    if [[ ! -f "$IDENTITY_ENV" ]] || [[ "$STORE_PACKAGE_IDENTITY_NAME" == REPLACE_* ]] || [[ "$STORE_PUBLISHER" == *REPLACE_* ]]; then
      STORE_PACKAGE_IDENTITY_NAME="ServerUI.Dev"
      STORE_PUBLISHER="CN=ServerUI Dev"
      STORE_PUBLISHER_DISPLAY_NAME="ServerUI Dev"
    fi
    return 0
  fi

  # store mode
  if [[ ! -f "$IDENTITY_ENV" ]]; then
    echo "Store mode requires $IDENTITY_ENV" >&2
    echo "Copy $IDENTITY_EXAMPLE → store-identity.env and fill Partner Center App identity values." >&2
    echo "Partner Center: Apps and games → product → Product management → App identity" >&2
    exit 1
  fi

  if [[ -z "$STORE_PACKAGE_IDENTITY_NAME" || "$STORE_PACKAGE_IDENTITY_NAME" == REPLACE_* ]]; then
    echo "STORE_PACKAGE_IDENTITY_NAME is missing or still a placeholder in $IDENTITY_ENV" >&2
    echo "Copy Package/Identity/Name from Partner Center → App identity." >&2
    exit 1
  fi
  if [[ -z "$STORE_PUBLISHER" || "$STORE_PUBLISHER" == *REPLACE_* ]]; then
    echo "STORE_PUBLISHER is missing or still a placeholder in $IDENTITY_ENV" >&2
    echo "Copy Package/Identity/Publisher (CN=...) from Partner Center → App identity." >&2
    exit 1
  fi
  if [[ -z "$STORE_PUBLISHER_DISPLAY_NAME" || "$STORE_PUBLISHER_DISPLAY_NAME" == REPLACE_* ]]; then
    echo "STORE_PUBLISHER_DISPLAY_NAME is missing or still a placeholder in $IDENTITY_ENV" >&2
    exit 1
  fi
}

load_identity

node "$DESKTOP_DIR/scripts/sync-version.mjs"
VERSION="$(cd "$DESKTOP_DIR" && node -p "require('./src-tauri/tauri.conf.json').version")"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version in tauri.conf.json: $VERSION" >&2
  exit 1
fi
# Store requires four-part version with revision 0.
MSIX_VERSION="${VERSION}.0"

ensure_rust_target() {
  if ! rustup target list --installed | grep -qx "$RUST_TRIPLE"; then
    echo "Installing Rust target $RUST_TRIPLE..."
    rustup target add "$RUST_TRIPLE"
  fi
}

echo
echo "────────────────────────────────────────"
echo "Building Microsoft Store MSIX ($MODE)"
echo "  Version:    $MSIX_VERSION"
echo "  Identity:   $STORE_PACKAGE_IDENTITY_NAME"
echo "  Publisher:  $STORE_PUBLISHER"
echo "  Display:    $STORE_PUBLISHER_DISPLAY_NAME"
echo "────────────────────────────────────────"

ensure_rust_target

echo "Building Go sidecar (windows/amd64)..."
FORCE_SIDECAR_REBUILD=1 \
  TAURI_ENV_TARGET_TRIPLE="$RUST_TRIPLE" \
  GOOS=windows GOARCH=amd64 \
  "$DESKTOP_DIR/scripts/prepare-sidecar.sh"

SIDECAR_SRC="$DESKTOP_DIR/src-tauri/binaries/serverui-server-${RUST_TRIPLE}.exe"
if [[ ! -f "$SIDECAR_SRC" ]]; then
  echo "Missing sidecar: $SIDECAR_SRC" >&2
  exit 1
fi

echo "Building Tauri release binary (msix-store, no NSIS/MSI bundle)..."
(
  cd "$DESKTOP_DIR"
  # --no-bundle: produce the exe + embedded frontend without NSIS/MSI.
  # --features msix-store: omit GitHub updater (Store owns updates).
  npm run tauri -- build \
    --no-bundle \
    --features msix-store \
    --config src-tauri/tauri.msix.conf.json \
    --config src-tauri/tauri.unsigned.conf.json
)

RELEASE_DIR="$TARGET_DIR/release"
EXE_SRC="$RELEASE_DIR/ServerUI.exe"
if [[ ! -f "$EXE_SRC" ]]; then
  # Fallback: Cargo package name
  if [[ -f "$RELEASE_DIR/serverui-desktop.exe" ]]; then
    EXE_SRC="$RELEASE_DIR/serverui-desktop.exe"
  else
    echo "Release executable not found under $RELEASE_DIR" >&2
    ls -la "$RELEASE_DIR"/*.exe 2>/dev/null || true
    exit 1
  fi
fi

echo "Staging package layout..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/Assets" "$OUT_DIR"

cp "$EXE_SRC" "$STAGING_DIR/ServerUI.exe"
# Runtime resolver looks for serverui-server.exe next to the Tauri exe.
cp "$SIDECAR_SRC" "$STAGING_DIR/serverui-server.exe"
# Also keep triple name for resolve_backend_binary candidates.
cp "$SIDECAR_SRC" "$STAGING_DIR/serverui-server-${RUST_TRIPLE}.exe"

# Copy any MSVC/WebView helper DLLs that sit beside the release exe (usually none).
while IFS= read -r -d '' dll; do
  cp "$dll" "$STAGING_DIR/"
done < <(find "$RELEASE_DIR" -maxdepth 1 -type f -iname '*.dll' -print0 2>/dev/null || true)

cp -R "$MSIX_DIR/Assets/." "$STAGING_DIR/Assets/"

# Materialize manifest with identity + version (template in-repo keeps placeholders).
MANIFEST_OUT="$STAGING_DIR/Package.appxmanifest"
export STORE_PACKAGE_IDENTITY_NAME STORE_PUBLISHER STORE_PUBLISHER_DISPLAY_NAME MSIX_VERSION
node -e '
const fs = require("fs");
const path = require("path");
const msixDir = process.argv[1];
const stagingDir = process.argv[2];
const name = process.env.STORE_PACKAGE_IDENTITY_NAME;
const publisher = process.env.STORE_PUBLISHER;
const display = process.env.STORE_PUBLISHER_DISPLAY_NAME;
const version = process.env.MSIX_VERSION;
let src = fs.readFileSync(path.join(msixDir, "Package.appxmanifest"), "utf8");
// Drop XML comments from the staged manifest (keeps Partner Center package clean).
src = src.replace(/<!--[\s\S]*?-->/g, "");
src = src
  .split("__STORE_PACKAGE_IDENTITY_NAME__").join(name)
  .split("__STORE_PUBLISHER_DISPLAY_NAME__").join(display)
  .split("__STORE_PUBLISHER__").join(publisher)
  .replace(/Version="[0-9.]+"/, "Version=\"" + version + "\"");
if (src.includes("__STORE_") || /REPLACE_WITH_PARTNER_CENTER/.test(src)) {
  console.error("Manifest still contains unresolved placeholders.");
  process.exit(1);
}
fs.writeFileSync(path.join(stagingDir, "Package.appxmanifest"), src);
console.log("Manifest identity:", name);
console.log("Manifest publisher:", publisher);
console.log("Manifest version:", version);
' "$MSIX_DIR" "$STAGING_DIR"

PACKAGE_BASENAME="ServerUI_${MSIX_VERSION}_x64"
PACKAGE_PATH="$OUT_DIR/${PACKAGE_BASENAME}.msix"
rm -f "$PACKAGE_PATH"

echo "Packaging with winapp..."
if [[ "$MODE" == "store" ]]; then
  # Partner Center re-signs Store submissions; do not require a local code-signing cert.
  winapp pack "$STAGING_DIR" \
    --manifest "$MANIFEST_OUT" \
    --exe ServerUI.exe \
    --skip-pri \
    --no-sign \
    --output "$PACKAGE_PATH"
else
  CERT="$MSIX_DIR/devcert.pfx"
  if [[ ! -f "$CERT" ]]; then
    echo "Generating local development certificate (publisher must match manifest)..."
    (
      cd "$MSIX_DIR"
      winapp cert generate --manifest "$MANIFEST_OUT" --if-exists skip
    )
  fi
  if [[ ! -f "$CERT" ]]; then
    echo "Expected $CERT after winapp cert generate" >&2
    exit 1
  fi
  winapp pack "$STAGING_DIR" \
    --manifest "$MANIFEST_OUT" \
    --exe ServerUI.exe \
    --skip-pri \
    --cert "$CERT" \
    --output "$PACKAGE_PATH"
fi

if [[ ! -f "$PACKAGE_PATH" ]]; then
  echo "MSIX output not found at $PACKAGE_PATH" >&2
  echo "Contents of $OUT_DIR:" >&2
  ls -la "$OUT_DIR" >&2 || true
  exit 1
fi

# Write a small validation report beside the package.
REPORT="$OUT_DIR/${PACKAGE_BASENAME}.validation.txt"
{
  echo "ServerUI MSIX validation"
  echo "mode=$MODE"
  echo "file=$PACKAGE_PATH"
  echo "size_bytes=$(wc -c < "$PACKAGE_PATH" | tr -d ' ')"
  echo "identity_name=$STORE_PACKAGE_IDENTITY_NAME"
  echo "publisher=$STORE_PUBLISHER"
  echo "publisher_display=$STORE_PUBLISHER_DISPLAY_NAME"
  echo "version=$MSIX_VERSION"
  echo "architecture=x64"
  echo "entrypoint=ServerUI.exe"
  echo "sidecar=serverui-server.exe"
  echo "staged_files:"
  (cd "$STAGING_DIR" && find . -type f | sort)
} > "$REPORT"

# MSIX is a ZIP package — copy to .zip and expand for identity / payload checks.
EXTRACT_DIR="$OUT_DIR/${PACKAGE_BASENAME}.extracted"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
ZIP_COPY="$OUT_DIR/${PACKAGE_BASENAME}.zip"
cp "$PACKAGE_PATH" "$ZIP_COPY"
# Convert Git Bash paths to Windows paths for PowerShell when possible.
WIN_ZIP="$ZIP_COPY"
WIN_DEST="$EXTRACT_DIR"
if command -v cygpath >/dev/null 2>&1; then
  WIN_ZIP="$(cygpath -w "$ZIP_COPY")"
  WIN_DEST="$(cygpath -w "$EXTRACT_DIR")"
fi
powershell.exe -NoProfile -Command \
  "Expand-Archive -LiteralPath '$WIN_ZIP' -DestinationPath '$WIN_DEST' -Force"
rm -f "$ZIP_COPY"

MANIFEST_EXTRACTED=""
if [[ -f "$EXTRACT_DIR/AppxManifest.xml" ]]; then
  MANIFEST_EXTRACTED="$EXTRACT_DIR/AppxManifest.xml"
elif [[ -f "$EXTRACT_DIR/Package.appxmanifest" ]]; then
  MANIFEST_EXTRACTED="$EXTRACT_DIR/Package.appxmanifest"
fi

if [[ -n "$MANIFEST_EXTRACTED" ]]; then
  {
    echo "extracted_manifest=$MANIFEST_EXTRACTED"
    grep -E 'Name=|Publisher=|Version=|ProcessorArchitecture=|Executable=' "$MANIFEST_EXTRACTED" || true
  } >> "$REPORT"
  for required in ServerUI.exe serverui-server.exe; do
    if [[ ! -f "$EXTRACT_DIR/$required" ]]; then
      echo "ERROR: packaged file missing: $required" >&2
      exit 1
    fi
  done
else
  echo "WARNING: could not extract package manifest for inspection" | tee -a "$REPORT"
fi

echo
echo "MSIX build complete ($MODE)"
echo "  Package: $PACKAGE_PATH"
echo "  Report:  $REPORT"
if [[ "$MODE" == "local" ]]; then
  echo
  echo "Local install (once per cert, elevated):"
  echo "  winapp cert install $MSIX_DIR/devcert.pfx"
  echo "  Add-AppxPackage -Path $PACKAGE_PATH"
else
  echo
  echo "Upload $PACKAGE_PATH in Partner Center → Packages (MSIX)."
  echo "The Store re-signs the package; no local CA certificate is required for submission."
fi
