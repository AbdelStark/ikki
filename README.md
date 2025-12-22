<h1 align="center">
  <br>
  <img src="public/ikki-logo.png" alt="Ikki" width="128">
  <br>
  Ikki
  <br>
</h1>

<h4 align="center">A privacy-first Zcash wallet with a premium mobile experience.</h4>

<p align="center">
  <a href="https://github.com/AbdelStark/ikki/actions/workflows/ci.yml"><img src="https://github.com/AbdelStark/ikki/actions/workflows/ci.yml/badge.svg?branch=main&style=flat-square" alt="CI"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/network-testnet-f59e0b?style=flat-square" alt="Testnet">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="#why-ikki">Why Ikki</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a> •
  <a href="#security">Security</a>
</p>

---

## Why Ikki

Ikki combines the privacy guarantees of Zcash with a modern consumer-grade experience. Built with Tauri and Svelte, it delivers native performance, responsive layouts, and a dark interface designed for uninterrupted mobile-first usage.

> **Status:** Testnet only. Do not use with real funds.

### What Ikki delivers

- Confidence: shielded transactions by default with unified addresses.
- Clarity: focused flows for sending, receiving, and reviewing history.
- Responsiveness: lightwalletd-backed sync with optimistic balance updates.

## Screenshots

<table>
  <tr>
    <td><img src="docs/misc/ikki-shot-tx-main.png" width="280" alt="Dashboard"></td>
    <td><img src="docs/misc/ikki-shot-receive.png" width="280" alt="Receive"></td>
  </tr>
  <tr>
    <td><img src="docs/misc/ikki-shot-tx-detail.png" width="280" alt="Transaction Detail"></td>
    <td><img src="docs/misc/ikki-shot-settings.png" width="280" alt="Settings"></td>
  </tr>
</table>

## Features

**Wallet**
- BIP-39 24-word seed phrases with HD derivation
- Unified addresses spanning Orchard and Sapling
- Diversified addresses to keep payments unlinkable
- Fast sync using lightwalletd compact blocks

**Privacy**
- Shielded-only transactions by design
- 512-byte encrypted memos
- No analytics or telemetry hooks

**Experience**
- Premium dark theme tuned for readability
- QR code scanning and generation
- Real-time background sync with progress and optimistic balances
- Transaction history grouped by date

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.81+
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform

### Local run

```bash
git clone https://github.com/AbdelStark/ikki.git
cd ikki
npm install
npm run tauri dev
```

### Production build

```bash
npm run tauri build
```

Artifacts are written to `src-tauri/target/release/`.

#### Mobile (Android & iOS)

Ikki can be packaged with Tauri Mobile for native distribution:

- Android init/dev/build: `npm run tauri:android:init`, `npm run tauri:android:dev`, `npm run tauri:android:build`
- iOS init/dev/build: `npm run tauri:ios:init`, `npm run tauri:ios:dev`, `npm run tauri:ios:build`

See [docs/mobile-packaging.md](docs/mobile-packaging.md) for full prerequisites, signing, and store distribution steps.

### CI packaging

- Desktop bundles (Linux, macOS, Windows): `.github/workflows/desktop-packages.yml`
- Android debug APK: `.github/workflows/android-packages.yml`
- iOS simulator debug bundle: `.github/workflows/ios-packages.yml`

### Minimal troubleshooting

- If builds fail on macOS or Windows, re-run the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and restart your shell.
- Ensure Rust toolchain is up to date: `rustup update stable`.
- Delete `src-tauri/target` when changing Rust toolchains to avoid stale artifacts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Svelte Frontend                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ wallet  │  │   ui    │  │  send   │  │  transaction  │  │
│  │  store  │  │  store  │  │  store  │  │     store     │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └───────┬───────┘  │
└───────┼────────────┼────────────┼───────────────┼──────────┘
        └────────────┴────────────┴───────────────┘
                              │
                    Tauri IPC Bridge
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      Rust Backend                           │
│  ┌──────────────────┐     ┌─────────────────────────────┐  │
│  │    AppState      │────▶│        IkkiWallet           │  │
│  │  (Tauri State)   │     │  ┌─────────────────────┐    │  │
│  └──────────────────┘     │  │   zcash_client_*    │    │  │
│                           │  └──────────┬──────────┘    │  │
│                           └─────────────┼───────────────┘  │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                               lightwalletd (gRPC)
                                          │
                               ┌──────────┴──────────┐
                               │   Zcash Testnet     │
                               └─────────────────────┘
```

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | Svelte 5, TypeScript, Vite |
| Backend | Rust, Tauri 2 |
| Zcash | zcash_client_backend, zcash_client_sqlite, zcash_proofs |
| Network | lightwalletd via gRPC/TLS |

### Data Storage

```
~/.ikki/
├── wallet.db              # SQLite (zcash_client_sqlite)
├── wallet_config.json     # Seed storage
└── wallet.db-wal          # WAL journal
```

## Development

### Structure

```
ikki/
├── src/                    # Svelte frontend
│   ├── lib/
│   │   ├── components/     # UI components
│   │   ├── stores/         # State management
│   │   └── utils/          # Tauri bridge
│   └── routes/             # Pages
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # IPC handlers
│       ├── wallet/         # Core wallet
│       └── state.rs        # App state
├── tools/
│   └── ikki-mcp/           # MCP server for Claude Code
└── public/                 # Static assets
```

### Core scripts

```bash
npm run dev          # Vite dev server
npm run build        # Build frontend
npm run tauri dev    # Development mode
npm run tauri build  # Production build
```

### MCP server for Claude Code

Ikki ships an MCP (Model Context Protocol) server for UI automation. It allows screenshot capture, clicking, and typing within the app window.

**Setup:**

```bash
cd tools/ikki-mcp
bun install
```

**Register with Claude Code:**

```bash
claude mcp add ikki-automation --scope project -- bun run /path/to/ikki/tools/ikki-mcp/src/index.ts
```

Or add to `.mcp.json` manually:

```json
{
  "mcpServers": {
    "ikki-automation": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "/path/to/ikki/tools/ikki-mcp/src/index.ts"]
    }
  }
}
```

**Available tools:**

| Tool | Description |
|------|-------------|
| `screenshot` | Capture the app window as base64 image |
| `click` | Click at window-relative coordinates |
| `type` | Type text or press special keys |
| `get_window_info` | Get window position, size, and state |

**Requirements:**
- macOS with Accessibility and Screen Recording permissions granted to your terminal
- The Ikki app must be running (`npm run tauri dev` or production build)

### Key files

| Frontend | Purpose |
|----------|---------|
| `Home.svelte` | Dashboard with balance |
| `Send.svelte` | Transaction creation |
| `Receive.svelte` | QR code + addresses |
| `History.svelte` | Transaction list |

| Backend | Purpose |
|---------|---------|
| `wallet/core.rs` | Wallet operations |
| `commands/wallet.rs` | Wallet IPC handlers |
| `commands/transactions.rs` | Transaction handlers |

## Security

**Current implementation:**
- Seed stored locally in `~/.ikki/wallet_config.json`
- File permissions `0600` (Unix)
- TLS for all lightwalletd connections

**Operational tips:**
1. Back up your seed phrase offline.
2. Use testnet only.
3. Verify addresses before sending.

**Reset wallet:**
```bash
rm -rf ~/.ikki/
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | `info` | Log level |

Server: `testnet.zec.rocks:443` (configurable in `wallet/config.rs`).

## Contributing

1. Fork the repo.
2. Create a branch (`git checkout -b feature/xyz`).
3. Commit changes.
4. Push and open a PR.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- [Zcash Foundation](https://www.zfnd.org/) — zcash-client libraries
- [Electric Coin Company](https://electriccoin.co/) — Zcash protocol
- [Tauri](https://tauri.app/) — native app framework
- [Svelte](https://svelte.dev/) — reactive UI

---

<p align="center">
  <sub>Built for privacy.</sub>
</p>
