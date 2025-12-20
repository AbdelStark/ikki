# Ikki UI/UX style guide

This guide captures the visual language, interaction patterns, and implementation tips for Ikki. It is written for both human designers/developers and LLM/AI agents; file paths, tokens, and component names are called out explicitly.

## Brand pillars

- **Premium dark theme**: Deep blacks (`--bg-primary`, `--bg-secondary`) with soft monochrome highlights (`--accent`, `--accent-soft`).
- **Calm clarity**: High contrast for primary content, muted for secondary text, generous spacing to avoid clutter.
- **Trust and composure**: Motion is subtle, purposeful, and short; focus states are crisp and accessible.

## Design tokens (source: `src/app.css`)

- **Colors:** Primary backgrounds `--bg-primary` / `--bg-secondary`, card `--bg-card`, elevated `--bg-elevated`, accents `--accent`, semantics `--success`, `--warning`, `--error`, `--info`. Use provided “*-muted” values for fills and states instead of inventing new opacity values.
- **Typography:** Inter with scale variables `--text-3xl` through `--text-2xs`. Default body size is `--text-base`. Use `--tracking-tight` / `--tracking-normal` for headings and body, respectively.
- **Spacing:** 4px base scale `--space-*`. Favor these variables to maintain rhythm; avoid raw pixel literals.
- **Radii & shadows:** Rounded corners via `--radius-*`; cards use `--radius-lg` + `--shadow-md`/`--shadow-lg`. Buttons default to `--radius-full` or `--radius-lg` depending on size.
- **Motion:** Use keyframes and durations from `src/app.css` (`--duration-normal`, `--ease-out`, etc.). Prefer `fadeInUp`, `fadeInDown`, `scaleIn` for entrances; avoid long or bouncy animations for critical flows.
- **Layout constraints:** Max width `--max-width: 428px`, nav height `--nav-height: 72px`, header height `--header-height: 56px`, safe-area env vars already defined.

## Layout patterns

- **Mobile-first:** Design for narrow widths; content lives inside a centered column up to `--max-width` with safe-area padding respected.
- **Card surfaces:** Use the `.card` utility for grouped content. Apply `.glass` when elevated translucency is desired.
- **Padding defaults:** Cards and sections typically use `--space-4` to `--space-6`. Lists should space items by `--space-3` to `--space-4`.
- **Spacing rhythm:** Vertical stacks should increase hierarchy spacing: label to input (`--space-2`), input to helper (`--space-1-5`), section to section (`--space-6`+).

## Components and patterns (paths in `src/lib/components/`)

- **Buttons (`Button.svelte`, `ActionButton.svelte`):** Primary actions use accent foreground on dark backgrounds; destructive actions use `--error`/`--error-muted`. Minimum touch size is `--touch-comfortable` (48px). Keep labels concise; add icons from `lucide-svelte` sparingly.
- **Inputs (`Input.svelte`):** Use `--bg-input` and subtle borders (`--border`). Placeholder text uses `--text-muted`. Focus state should rely on `--focus-ring`.
- **Navigation (`BottomNav.svelte`):** Icons + labels; ensure active state uses accent or higher contrast. Leave room for safe-area insets.
- **Feedback:** Toasts (`Toast.svelte`) convey success/error/warning/info with semantic colors. Avoid modal confirmations unless critical; favor inline messaging and toasts.
- **Status indicators (`SyncIndicator.svelte`, `InitialSync.svelte`):** Keep progress short and informative; show current block/percentage when available. Avoid simultaneous competing indicators.
- **List items (`TransactionItem.svelte`, `PendingTransactionItem.svelte`):** Use `--receive` for incoming and `--send` for outgoing hints. Apply `.truncate` for addresses and memos.

## Interaction principles

- **Clarity first:** Each screen should have one primary action. Secondary actions sit in lower visual hierarchy (muted color or outline).
- **Predictable motion:** Use short durations (`--duration-normal` or faster). Avoid new custom animations; reuse provided keyframes and easings.
- **Accessibility:** Maintain color contrast using provided tokens; ensure focus-visible states are present for all interactive elements. Hit areas ≥ `--touch-comfortable`.
- **Error handling:** Inline validation where possible; show toasts with actionable messages. For background operations, pair toasts with status updates in sync indicators or lists.

## Content guidelines

- **Tone:** Confident, calm, concise. Prefer verbs: “Send”, “Receive”, “Copy address”.
- **Numbers:** Use monospace (`.mono`, `--font-mono`) for balances and amounts; align decimals. Provide clear currency context in labels.
- **Address handling:** Truncate with middle or end ellipsis; avoid exposing full strings unless explicitly requested via copy actions.

## Implementation tips for LLM/AI agents

- Reference exact file paths and tokens when proposing changes (e.g., `src/lib/components/Button.svelte`, `--accent-muted`).
- Do not introduce ad-hoc hex values; extend the token set in `src/app.css` if a new semantic is truly required.
- Keep business logic out of components; wire new flows through stores in `src/lib/stores/` and Tauri helpers in `src/lib/utils/tauri.ts`.
- When adding a new component, include short prop/type documentation near the script block and keep styles scoped.
- For UI changes affecting visuals, update this guide and provide before/after context in PR descriptions when possible.

## Quick checklists

**Adding a new screen:**
- Define a route component under `src/routes/`.
- Connect navigation via the `ui` store (`ui.navigate` + `currentView`).
- Use design tokens for layout and typography; reuse components from `src/lib/components/`.
- Handle data through stores and `src/lib/utils/tauri.ts`; avoid direct invokes in deeply nested components.
- Provide success/error feedback with `ui.showToast`.

**Styling a new component:**
- Start with token variables for color, spacing, radius, and motion.
- Respect touch targets and safe areas.
- Verify focus-visible styling and contrast.
- Use existing animation utilities instead of new keyframes.
