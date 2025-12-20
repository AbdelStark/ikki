# Ikki coding architecture guide

This document explains how the app is structured and how to extend it safely. It is intended to be readable by both humans and LLM/AI agents; section headers, path callouts, and checklists are explicit so automated tools can quickly map concepts to files.

## High-level system map

- **Stack:** Vite-powered Svelte SPA paired with a Tauri 2.0 Rust backend for wallet, sync, and transaction commands.
- **Entry points:**
  - `src/main.ts` bootstraps Svelte, mounts `App.svelte`, and wires in the global stylesheet (`src/app.css`).
  - `src-tauri/src/main.rs` launches the Tauri runtime and registers backend commands.
- **State hubs:** Svelte stores live in `src/lib/stores/`. They hold UI view state, wallet data, sync progress, and pending/broadcast transactions.
- **Frontend features:** Screens in `src/routes/*.svelte` connect to stores and UI components in `src/lib/components/`.
- **Backend bridge:** `src/lib/utils/tauri.ts` exposes typed wrappers around Tauri commands (invoke + event listeners) for all wallet operations.

## Frontend architecture

### View composition

- `App.svelte` controls global view routing with the `ui` store and renders the active route component (`Home`, `Send`, `Receive`, `History`, `Settings`, `Contacts`, `TransactionDetail`).
- Shared interface pieces (bottom nav, toasts, sync indicator, initial sync screen) live in `src/lib/components/` and are mounted in `App.svelte`.
- Styling is token-driven via CSS custom properties in `src/app.css`; all components rely on those tokens for color, spacing, typography, and motion.

### State management pattern

- Stores in `src/lib/stores/` wrap Svelte `writable`/`derived` to keep data and view state in a single place. Examples:
  - `ui.ts` handles navigation, modals, and toast lifecycle.
  - `wallet.ts` and `transactions.ts` hold balances and transaction history.
  - `sync.ts` tracks background sync progress and errors.
  - `pendingTransactions.ts` tracks in-flight sends and clean-up logic.
- Screens subscribe to stores instead of owning their own fetch logic; the stores are fed by utility functions that encapsulate Tauri calls.
- Side effects are centralized: `App.svelte` handles initial load, background sync polling, and pending transaction polling so individual screens remain mostly declarative.

### Data flow

1. UI triggers an action (e.g., send flow) through a component or store method.
2. The action calls a typed function in `src/lib/utils/tauri.ts` (e.g., `sendTransactionBackground`, `startBackgroundSync`).
3. The Rust backend executes the wallet command and returns structured data.
4. Stores update with the new data; components reactively re-render.
5. Toasts and indicators in `App.svelte` provide global feedback for success/failure and sync state.

### Adding or modifying features

- **New UI surface:** Place screens under `src/routes/` and wire navigation via the `ui` store’s `navigate` method; reuse design tokens from `src/app.css`.
- **Shared components:** Put reusable pieces in `src/lib/components/` and keep them stateless when possible; accept props and surface events instead of reaching into stores directly.
- **Store changes:** Add store modules under `src/lib/stores/`; prefer small, focused stores with clear setters and derived exports for computed values.
- **Async work:** Encapsulate Tauri invocations in `src/lib/utils/tauri.ts`. Keep UI components unaware of invocation details so future backend changes stay localized.
- **Error handling:** Surface failures through store errors and `ui.showToast` with meaningful messages. Avoid silent failures; log via `console.error` for debugging parity between frontend and backend.

## Backend architecture (Tauri)

- The Rust backend resides in `src-tauri/`:
  - `src-tauri/src/main.rs` initializes Tauri and exposes commands to the frontend.
  - `src-tauri/src/commands/` groups wallet and sync commands.
  - `src-tauri/src/state.rs` defines shared application state (e.g., wallet handles, sync status) injected into commands.
  - `src-tauri/src/wallet/` implements wallet-specific logic.
- **Command boundary:** Every frontend call in `src/lib/utils/tauri.ts` should have a matching Rust command. Align naming and payloads; keep request/response structs in sync.
- **Background tasks:** Sync and transaction sending can run in the background. Ensure commands that spawn tasks return immediately and expose progress via `get_sync_status` or polling endpoints.

### Extending backend commands

- Add a Rust command in `src-tauri/src/commands/` and register it in `main.rs`.
- Define request/response types that serialize cleanly to JSON; mirror them in TypeScript interfaces in `src/lib/utils/tauri.ts`.
- Prefer deterministic, idempotent operations; keep side effects (disk writes, network calls) contained and traceable.
- When adding long-running work, consider emitting events (`sync-progress`, `sync-complete`, `sync-error`) or expose a poller to keep the UI responsive.

## Testing and observability notes

- **Frontend:** Use Vite `npm run dev` for local inspection; add lightweight unit tests around store logic if behavior becomes complex.
- **Backend:** Add Rust tests alongside modules in `src-tauri/src/` to validate new wallet logic or serialization contracts.
- **Tracing:** Keep console logs concise and contextual; include the command name or store when logging errors to help correlate UI and backend paths.

## Conventions for humans and AI agents

- Reference files by full paths when proposing changes to reduce ambiguity for automated tooling.
- Update both the TypeScript bridge (`src/lib/utils/tauri.ts`) and Rust command signatures together to avoid runtime serialization errors.
- Favor pure, prop-driven Svelte components; let stores coordinate state.
- Prefer the design tokens in `src/app.css` over ad-hoc values to maintain the brand look.
- Keep navigation and global UX in `App.svelte`; avoid per-screen global side effects unless absolutely necessary.
