# Microsoft Store MSIX packaging

ServerUI ships Windows **NSIS** / **MSI** installers for GitHub Releases. For the
Microsoft Store **MSIX / MSIXBundle upload** workflow, this repo uses Microsoft’s
[WinApp CLI](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/tauri)
around a Tauri 2 release binary plus the Go sidecar.

Tauri 2 does **not** emit MSIX natively. The official Tauri Store guide targets
EXE/MSI listing; this document covers the separate MSIX package path.

## What gets packaged

| Item | Source |
| ---- | ------ |
| `ServerUI.exe` | Tauri release build (`--no-bundle`, feature `msix-store`) |
| `serverui-server.exe` | Go backend sidecar (`prepare-sidecar.sh`) |
| UI assets | Embedded in the Tauri binary via Next.js static export |
| Icons / tiles | `apps/desktop/msix/Assets/` (from `branding/serverui-icon-1024.png`) |
| Identity | `Package.appxmanifest` + `store-identity.env` |

WebView2 uses the system **Evergreen Runtime** (`webviewInstallMode: skip` for
MSIX — there is no NSIS bootstrapper). Windows 11 usually includes it; Windows 10
may need the [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

The GitHub **updater plugin is disabled** for MSIX Store builds (`msix-store`
Cargo feature + `msix-default` capabilities). Store apps must update through
Partner Center, not GitHub Releases.

NSIS/MSI generation is unchanged (`make desktop-build-windows-x64`).

## Prerequisites (Windows)

1. Node.js 22+, Go, Rust (same as desktop builds)
2. Git Bash (via Git for Windows) for `make` recipes
3. WinApp CLI: `winget install microsoft.winappcli --source winget`
4. Workspace `.env` (`make setup-env`) for local config used by the build chain
5. For **store** mode: Partner Center app identity values (below)

## Partner Center values (required for Store upload)

Do **not** invent the publisher CN / package identity.

1. Open [Partner Center](https://partner.microsoft.com/dashboard)
2. **Apps and games** → create or open the ServerUI product as an **MSIX** app
3. **Product management** → **App identity**

Copy into `apps/desktop/msix/store-identity.env` (from `store-identity.example.env`):

| Env var | Partner Center field |
| ------- | -------------------- |
| `STORE_PACKAGE_IDENTITY_NAME` | Package/Identity/Name |
| `STORE_PUBLISHER` | Package/Identity/Publisher (full DN, typically `CN={GUID}`) |
| `STORE_PUBLISHER_DISPLAY_NAME` | Package/Properties/PublisherDisplayName |

`store-identity.env` is gitignored.

## Build commands

```bash
# Self-signed local/sideload package (no Partner Center identity required)
make desktop-build-msix MODE=local
# or: cd apps/desktop && npm run build:msix:local

# Unsigned package for Partner Center (requires store-identity.env)
make desktop-build-msix MODE=store
# or: cd apps/desktop && npm run build:msix:store
```

### Output

```text
dist/msix/ServerUI_<version>.0_x64.msix
dist/msix/ServerUI_<version>.0_x64.validation.txt
```

Version comes from `apps/desktop/src-tauri/tauri.conf.json` (SemVer `X.Y.Z`) and
is written to the manifest as `X.Y.Z.0`. The Store reserves the fourth digit;
keep it `0`.

WinApp CLI does not produce `.msixupload` archives. Partner Center accepts
`.msix` / `.msixbundle` directly. Optional crash-symbol `.msixupload` packaging
is a separate Visual Studio / MakeAppx flow if you need it later.

## Signing

| Mode | Signing | Purpose |
| ---- | ------- | ------- |
| `local` | Self-signed `apps/desktop/msix/devcert.pfx` via `winapp cert generate` | Sideload testing on this PC |
| `store` | `--no-sign` | Partner Center / Store **re-signs** on submission |

Local install of a self-signed package (once per cert, elevated):

```powershell
winapp cert install .\apps\desktop\msix\devcert.pfx
Add-AppxPackage -Path .\dist\msix\ServerUI_0.2.0.0_x64.msix
```

A self-signed cert is **not** sufficient for Store publication. Do not commit
`.pfx` files.

## Layout in the repo

```text
apps/desktop/msix/
  Package.appxmanifest          # placeholders filled at pack time
  Assets/                       # Store tile / logo assets
  store-identity.example.env    # template for Partner Center values
  store-identity.env            # local (gitignored)
  staging/                      # pack layout (gitignored)
  devcert.pfx                   # local test cert (gitignored)
apps/desktop/scripts/build-msix-release.sh
apps/desktop/src-tauri/tauri.msix.conf.json
apps/desktop/src-tauri/capabilities/msix-default.json
```

## Remaining Store certification notes

- Reserve the app name and use the **exact** App identity strings in the manifest.
- Provide Store listing screenshots / logos under Partner Center (repo
  `microsoft-store/` folders are reserved for that marketing content).
- Run the [Windows App Certification Kit](https://learn.microsoft.com/windows/uwp/debug-test-perf/windows-app-certification-kit)
  on a release candidate when possible.
- MSIX builds intentionally omit the GitHub updater; keep Store and GitHub
  channels’ update stories separate.
- Full-trust + `internetClient` are declared for the Win32 shell and outbound SSH.
- Confirm WebView2 Evergreen is present on target OS images used for certification.
