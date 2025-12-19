# Ikki roadmap issue drafts

Draft GitHub issues for the near-term roadmap. Each issue includes context, tasks, and acceptance criteria so they can be created directly in the repository issue tracker.

---

## Issue: Assess Zcash Rust WASM viability and WebZjs integration

**Type:** spike / research  
**Goal:** Determine whether the existing Zcash Rust dependencies can run reliably in browsers (WASM) and whether WebZjs is mature enough to use.

### Tasks
- Inventory the current Rust crates used in `src-tauri/src` and map them to WASM-ready equivalents. Note any `std` features that must be disabled or replaced.
- Build a minimal `wasm-pack` proof that derives a viewing key and fetches compact blocks via WebZjs; log blockers such as threading, gRPC/WebSockets, and performance limits.
- Document findings and the recommended stack in `docs/architecture/browser-wasm.md`, including decision points (WebZjs vs. custom bindings) and required feature flags.

### Acceptance criteria
- Short write-up committed to `docs/architecture/browser-wasm.md` summarizing feasibility, blockers, and recommended path.
- List of required upstream changes or forks if WebZjs is adopted.
- Rough effort estimate for productionizing a browser-compatible Zcash client library.

---

## Issue: Browser extension shell (Manifest v3) with read-only wallet view

**Type:** feature / prototype  
**Goal:** Prototype a Chromium/Firefox extension that reuses Ikki UI primitives to display balance and activity from a viewing key without send flows.

### Tasks
- Scaffold an extension in `tools/extension/` using Vite + Svelte and share UI components from `src/lib/components` where possible.
- Implement state hydration from an imported viewing key with IndexedDB-backed persistence; avoid Tauri APIs.
- Wire a minimal client to lightwalletd over HTTPS/WebSockets for balance and recent transactions; handle network/config errors gracefully.
- Build a popup and options page that render balance and activity with loading/empty/error states.

### Acceptance criteria
- Extension builds locally (Chromium Manifest v3) and displays balance plus recent transactions from a viewing key.
- No send/receive or key-export flows included; read-only scope documented.
- README in `tools/extension/` covering setup, build, and how to side-load for testing.

---

## Issue: Spike — Tauri mobile viability for Ikki

**Type:** spike / research  
**Goal:** Evaluate Tauri’s mobile targets (iOS/Android) for Ikki parity with desktop flows.

### Tasks
- Follow the Tauri mobile guide to generate platform projects and wire existing Svelte routes for onboarding, sync status, and send flow.
- Identify required plugins for camera/QR, secure storage, and notifications; document gaps and workarounds.
- Measure startup time, bundle size, and UI responsiveness on emulators or devices; note platform-specific issues.
- Write results and risks to `docs/architecture/mobile-spike.md`, including a go/no-go recommendation and next steps.

### Acceptance criteria
- Documented spike results with metrics, risks, and recommended next steps committed to `docs/architecture/mobile-spike.md`.
- Checklist of missing plugins or platform blockers with proposed mitigations.
- Demo builds (even if rough) can launch and reach the dashboard on both platforms.

---

## Issue: Optimize sync loop and incoming-payment reactivity

**Type:** enhancement  
**Goal:** Make sync more efficient and responsive so new incoming payments surface quickly in the UI.

### Tasks
- Audit sync triggers and intervals in `src/lib/stores/wallet.ts` and `src-tauri/src` to remove redundant work and tune polling.
- Add compact-block prefetching and memoized note tracking to cut duplicate decryptions; instrument with debug logs for profiling.
- Emit UI signals for new notes to the activity store (`src/lib/stores/transaction.ts`) and surface a toast/badge for newly detected funds.
- Capture benchmarks comparing current vs. optimized sync (time-to-first-detection, CPU usage, network requests).

### Acceptance criteria
- Benchmarks show reduced time-to-detection for incoming payments and fewer redundant decryptions.
- UI surfaces a clear indicator when new funds arrive without requiring a manual refresh.
- Feature-flag or configuration option allows reverting to the previous sync strategy if regressions occur.

---

## Issue: Hardened test suite across Rust, Svelte, and e2e layers

**Type:** test / quality  
**Goal:** Increase confidence with layered tests across Rust backend, Svelte frontend, and end-to-end flows.

### Tasks
- Add Rust unit and integration tests in `src-tauri/src` covering address derivation, shielding, memo handling, and lightwalletd interactions (with fixtures/mocks where needed).
- Expand Svelte component tests in `src/lib/components` using Vitest + Testing Library for forms, activity list rendering, and error states.
- Create Playwright smoke tests in `tools/e2e` that exercise onboarding → sync → send → history using a mocked lightwalletd backend.
- Wire the suites into CI (GitHub Actions) with cached Rust/Node toolchains and a platform matrix.

### Acceptance criteria
- New tests run locally and in CI, with documented commands in the repository.
- Coverage includes Rust wallet logic, key UI components, and an end-to-end happy path.
- Flaky tests identified and quarantined or fixed with deterministic fixtures.

---

## Issue: Filters and sorting in activity view

**Type:** feature / UX  
**Goal:** Help users triage activity by adding filters and sorting options to transaction history.

### Tasks
- Extend `src/lib/stores/transaction.ts` to expose derived filters (status, amount range, memo presence) and sort options (date, amount).
- Update activity view components in `src/lib/components/activity/` to render filter chips/dropdowns with persisted user selection (e.g., local storage).
- Ensure empty/error states and pagination/virtualization still behave correctly under filters; add UI tests for filter/sort combinations.
- Document usage and defaults in the component README or story.

### Acceptance criteria
- Activity view shows functional filters and sort controls with sensible defaults and persistence across reloads.
- UI states (empty, loading, error) remain intact when filters are applied.
- Automated tests cover representative filter/sort cases and pass in CI.
