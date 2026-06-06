# Sidecar binaries

This directory holds the compiled **Luna Core** (Go) sidecar that Tauri spawns
at runtime. Files are build artifacts and are git-ignored.

Tauri resolves a sidecar named `luna-core` to a file suffixed with the Rust host
target triple, e.g. `luna-core-x86_64-unknown-linux-gnu` (or `…-pc-windows-msvc.exe`).

Build it from the Go source before running the app:

```sh
make -C backend build          # auto-detects the triple from rustc
# or, explicitly:
make -C backend build TRIPLE=x86_64-unknown-linux-gnu
```

`pnpm tauri dev` / `pnpm tauri build` expect this binary to already exist.
