# Microsoft Store listing assets

Use this folder for Partner Center **Store listing** creatives (screenshots,
promotional images). Packaging configuration and the MSIX build live under
`apps/desktop/msix/` — see [docs/microsoft-store-msix.md](../docs/microsoft-store-msix.md).

```bash
make desktop-build-msix MODE=local   # sideload test package → dist/msix/
make desktop-build-msix MODE=store   # requires apps/desktop/msix/store-identity.env
```
