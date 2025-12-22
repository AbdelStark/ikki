# CLAUDE.md - AI Agent Guide for Ikki

This file provides comprehensive guidance for AI agents (Claude Code, LLMs) working on the Ikki codebase. It covers project structure, technology stack, development workflows, coding patterns, and available skills.

## Project Overview

**Ikki** is a privacy-first Zcash desktop wallet built with Tauri and Svelte. It combines Zcash's privacy guarantees with a modern, consumer-grade UI experience.

- **Version:** 0.1.1
- **License:** MIT
- **Status:** Testnet only (do not use with real funds)
- **Repository:** Desktop wallet application

## Quick Reference

### Essential Commands

```bash
# Install dependencies
npm install

# Development
npm run dev              # Vite dev server (frontend only, port 5173)
npm run tauri dev        # Full desktop app with Rust backend

# Production builds
npm run build            # Frontend production build
npm run tauri build      # Desktop production build

# MCP automation setup (optional)
cd tools/ikki-mcp && bun install
```

### Key Paths

| Purpose | Path |
|---------|------|
| Frontend source | `src/` |
| Svelte routes/pages | `src/routes/` |
| Reusable components | `src/lib/components/` |
| State management | `src/lib/stores/` |
| Tauri IPC bridge | `src/lib/utils/tauri.ts` |
| Design tokens | `src/app.css` |
| Rust backend | `src-tauri/` |
| Tauri commands | `src-tauri/src/commands/` |
| Wallet core logic | `src-tauri/src/wallet/` |
| App state | `src-tauri/src/state.rs` |
| MCP automation | `tools/ikki-mcp/` |
| Agent skills | `skills/` |
| Documentation | `docs/` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Svelte 5 Frontend                       │
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
                               lightwalletd (gRPC/TLS)
                                          │
                               ┌──────────┴──────────┐
                               │   Zcash Testnet     │
                               └─────────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | Svelte 5 | ^5.16.0 |
| Frontend Build | Vite | ^6.0.5 |
| Language | TypeScript | ^5.7.2 |
| Desktop Runtime | Tauri 2 | ^2.5 |
| Backend Language | Rust | 1.81.0+ |
| Icons | Lucide Svelte | ^0.468.0 |
| QR Codes | qrcode | ^1.5.4 |
| Zcash Libraries | zcash_client_* | Git rev 9f47de6 |

## Directory Structure

```
ikki/
├── src/                          # Svelte frontend
│   ├── main.ts                   # App mount point
│   ├── App.svelte                # Root component, routing
│   ├── app.css                   # Design system tokens
│   ├── lib/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── AccountCard.svelte
│   │   │   ├── ActionButton.svelte
│   │   │   ├── BottomNav.svelte
│   │   │   ├── Button.svelte
│   │   │   ├── InitialSync.svelte
│   │   │   ├── Input.svelte
│   │   │   ├── PendingTransactionItem.svelte
│   │   │   ├── SyncIndicator.svelte
│   │   │   ├── Toast.svelte
│   │   │   └── TransactionItem.svelte
│   │   ├── stores/               # Svelte state stores
│   │   │   ├── wallet.ts         # Balance & address
│   │   │   ├── ui.ts             # Navigation, modals, toast
│   │   │   ├── sync.ts           # Sync progress
│   │   │   ├── transactions.ts   # Transaction history
│   │   │   ├── transaction.ts    # Single tx detail
│   │   │   ├── send.ts           # Send form state
│   │   │   ├── pendingTransactions.ts
│   │   │   ├── preferences.ts
│   │   │   └── pricing.ts        # USD conversion
│   │   └── utils/
│   │       ├── tauri.ts          # Typed Tauri IPC wrappers
│   │       └── format.ts         # Display formatting
│   └── routes/                   # Page components
│       ├── Home.svelte
│       ├── Send.svelte
│       ├── Receive.svelte
│       ├── History.svelte
│       ├── Settings.svelte
│       ├── Contacts.svelte
│       ├── Onboarding.svelte
│       └── TransactionDetail.svelte
│
├── src-tauri/                    # Rust Tauri backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs               # Tauri entry point
│       ├── lib.rs                # Command registration
│       ├── state.rs              # AppState, SyncState
│       ├── commands/
│       │   ├── wallet.rs         # Wallet operations
│       │   └── transactions.rs   # Send, history
│       └── wallet/
│           ├── core.rs           # IkkiWallet implementation
│           └── config.rs         # Seed storage, lightwalletd
│
├── tools/
│   └── ikki-mcp/                 # MCP automation server
│
├── skills/                       # Agent skill definitions
│   ├── survey-repo.skill.yaml
│   ├── setup-node-workspace.skill.yaml
│   ├── build-frontend.skill.yaml
│   ├── tauri-dev-session.skill.yaml
│   ├── setup-ikki-mcp.skill.yaml
│   └── ui-copy-change.skill.yaml
│
└── docs/                         # Documentation
    ├── agents/                   # Agent-specific docs
    ├── architecture/             # Architecture guides
    ├── ui-ux-style-guide.md
    └── zcash-sync-strategy.md
```

## Working Style Guidelines

### Do

- Use `rg` (ripgrep) for searches; avoid `ls -R` and `grep -R`
- Keep edits minimal and purposeful
- Update relevant docs when behavior changes
- Prefer small, self-contained commits with clear messages
- Reference files by full paths when proposing changes
- Keep UI components prop-driven and stateless where possible
- Use design tokens from `src/app.css` instead of inline values

### Don't

- Wrap imports in `try/catch` (repo policy)
- Introduce ad-hoc hex color values (extend tokens if needed)
- Create silent failures; always surface errors via toasts
- Put business logic in components; use stores instead
- Skip updating both TypeScript bridge and Rust signatures together

## Coding Patterns

### Frontend Patterns

**State Management:**
- Stores live in `src/lib/stores/` using Svelte `writable`/`derived`
- Screens subscribe to stores; stores are fed by Tauri utilities
- Side effects centralized in `App.svelte` (init, sync polling, pending tx)

**Data Flow:**
1. UI triggers action → component/store method
2. Action calls typed function in `src/lib/utils/tauri.ts`
3. Rust backend executes command, returns structured data
4. Stores update → components reactively re-render
5. Global feedback via toasts and indicators in `App.svelte`

**Adding Features:**
- New screens: `src/routes/`, wire via `ui.navigate()`
- New components: `src/lib/components/`, keep stateless
- New stores: `src/lib/stores/`, small and focused
- Async work: encapsulate in `src/lib/utils/tauri.ts`

### Backend Patterns

**Command Structure:**
- Commands in `src-tauri/src/commands/`
- Register in `src-tauri/src/lib.rs` via `generate_handler![]`
- Shared state in `src-tauri/src/state.rs`

**Background Tasks:**
- Sync and tx sending run in background
- UI polls for progress via `get_sync_status`
- Emit events for real-time updates: `sync-progress`, `sync-complete`, `sync-error`

**Extending Commands:**
1. Add Rust command in `src-tauri/src/commands/`
2. Register in `lib.rs`
3. Define matching TypeScript interface in `src/lib/utils/tauri.ts`
4. Keep request/response structs in sync

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Stores | lowercase + `.ts` | `wallet.ts` |
| Routes | PascalCase + `.svelte` | `Home.svelte` |
| Components | PascalCase + `.svelte` | `AccountCard.svelte` |
| Rust modules | snake_case | `wallet.rs` |
| TypeScript functions | camelCase | `startBackgroundSync` |
| Tauri commands | snake_case | `get_wallet_summary` |

## UI/UX Guidelines

### Design Tokens (from `src/app.css`)

- **Colors:** `--bg-primary`, `--bg-secondary`, `--accent`, `--success`, `--warning`, `--error`
- **Typography:** Inter, scale `--text-3xl` to `--text-2xs`
- **Spacing:** 4px base scale `--space-*`
- **Radii:** `--radius-sm` to `--radius-full`
- **Motion:** `--duration-normal`, `--ease-out`, keyframes `fadeInUp`, `scaleIn`
- **Layout:** Max width `--max-width: 428px`, mobile-first

### Component Guidelines

- Buttons: min touch size `--touch-comfortable` (48px)
- Cards: use `.card` utility, `--radius-lg`, `--shadow-md`
- Inputs: `--bg-input`, focus via `--focus-ring`
- Toasts: semantic colors for success/error/warning/info
- Addresses: truncate with ellipsis, monospace font

## Available Skills

Skills are YAML definitions in `skills/` for common workflows:

| Skill | File | Purpose |
|-------|------|---------|
| Survey Repository | `survey-repo.skill.yaml` | First contact reconnaissance |
| Setup Node Workspace | `setup-node-workspace.skill.yaml` | Install dependencies |
| Build Frontend | `build-frontend.skill.yaml` | Vite production build |
| Tauri Dev Session | `tauri-dev-session.skill.yaml` | Launch desktop dev environment |
| Setup MCP | `setup-ikki-mcp.skill.yaml` | Configure UI automation |
| UI Copy Change | `ui-copy-change.skill.yaml` | Update text/labels safely |

### Using Skills

1. Read the skill YAML file
2. Verify prerequisites are met
3. Execute steps in order
4. Collect specified artifacts (logs, screenshots)

## MCP Automation Server

The MCP server at `tools/ikki-mcp/` provides UI automation for testing:

### Available Tools

- `screenshot` - Capture app window or full screen
- `click` - Click at window-relative coordinates
- `type` - Type text or press special keys
- `get_window_info` - Window position, size, state

### Setup

```bash
# Requirements: macOS, Bun runtime, Accessibility permissions
cd tools/ikki-mcp
bun install

# Register with Claude Code (already in .mcp.json)
claude mcp add ikki-automation --scope project -- bun run $(pwd)/src/index.ts
```

### Usage Requirements

- macOS only (uses AppleScript + system APIs)
- Ikki app must be running (`npm run tauri dev`)
- Grant Accessibility & Screen Recording permissions

## Security Considerations

### Critical

- **Seed phrases** stored at `~/.ikki/wallet_config.json` (0600 permissions)
- **Never commit** seed data or wallet files
- **Testnet only** - verify network in `src-tauri/src/wallet/config.rs`
- Default server: `testnet.zec.rocks:443`

### Best Practices

- Keep IPC serialization in sync (TypeScript ↔ Rust)
- Surface all errors via `ui.showToast()` for user feedback
- Background tasks should never block UI thread
- Validate at system boundaries (user input, external APIs)

## Environment Setup

### Prerequisites

- Node.js 18+
- Rust 1.81+ (via rustup)
- Tauri prerequisites:
  - macOS: Xcode Command Line Tools
  - Windows: MSVC, WebView2
  - Linux: build-essentials, webkit2gtk
- Bun (optional, for MCP development)

### Environment Variables

- `RUST_LOG` - Log level (default: `info`, use `debug` for verbose)

### Build Artifacts

- Frontend: `dist/`
- Backend: `src-tauri/target/release/`

## Workflow Checklists

### Before Starting Work

- [ ] Read `AGENTS.md` and this file
- [ ] Run `npm install`
- [ ] Verify build: `npm run build`
- [ ] Check `docs/agents/README.md` for detailed patterns

### Adding a New Screen

- [ ] Create route component in `src/routes/`
- [ ] Wire navigation via `ui.navigate()` + `currentView`
- [ ] Use design tokens from `src/app.css`
- [ ] Reuse components from `src/lib/components/`
- [ ] Handle data through stores
- [ ] Provide feedback with `ui.showToast()`

### Adding a Tauri Command

- [ ] Add Rust command in `src-tauri/src/commands/`
- [ ] Register in `src-tauri/src/lib.rs` `generate_handler![]`
- [ ] Define TypeScript interface in `src/lib/utils/tauri.ts`
- [ ] Add wrapper function with proper error handling
- [ ] Test with `npm run tauri dev`

### Before Committing

- [ ] Run `npm run build` (frontend)
- [ ] If Rust changed: `npm run tauri build` or `cargo check`
- [ ] Update relevant docs if behavior changed
- [ ] Keep commits small and focused

## Related Documentation

- `AGENTS.md` - Root agent operating guide
- `docs/agents/README.md` - Agent handbook with detailed patterns
- `docs/agents/skills/INDEX.md` - Skills index
- `docs/architecture/coding-architecture-guide.md` - Detailed architecture
- `docs/ui-ux-style-guide.md` - Design system details
- `docs/zcash-sync-strategy.md` - Sync implementation
- `docs/roadmap-issues.md` - Future roadmap

## Entry Points Reference

| File | Purpose |
|------|---------|
| `src/main.ts` | Mounts Svelte app |
| `src/App.svelte` | Root component, routing, global state |
| `index.html` | HTML shell |
| `src-tauri/src/main.rs` | Tauri app launcher |
| `src-tauri/src/lib.rs` | Tauri builder, command registration |
