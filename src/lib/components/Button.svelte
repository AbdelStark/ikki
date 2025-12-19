<script lang="ts">
  import { Loader2 } from "lucide-svelte";

  export let variant: "primary" | "secondary" | "ghost" | "danger" = "primary";
  export let size: "sm" | "md" | "lg" = "md";
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let fullWidth: boolean = false;
  export let onclick: () => void = () => {};
</script>

<button
  class="btn btn-{variant} btn-{size}"
  class:full-width={fullWidth}
  class:loading
  disabled={disabled || loading}
  {onclick}
>
  {#if loading}
    <Loader2 size={size === "sm" ? 14 : 18} class="spinner" />
  {/if}
  <span class="btn-content" class:hide={loading}><slot /></span>
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-weight: var(--font-semibold);
    border: none;
    cursor: pointer;
    white-space: nowrap;
    letter-spacing: var(--tracking-wide);
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out),
      opacity var(--duration-fast) var(--ease-out);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn :global(.spinner) {
    animation: spin 0.8s linear infinite;
    position: absolute;
  }

  .btn-content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .btn-content.hide {
    opacity: 0;
  }

  /* ═══════════════════════════════════════════════════════════════
     SIZES
     ═══════════════════════════════════════════════════════════════ */

  .btn-sm {
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    border-radius: var(--radius-sm);
    height: 36px;
  }

  .btn-md {
    padding: 0 var(--space-5);
    font-size: var(--text-sm);
    border-radius: var(--radius-md);
    height: var(--touch-comfortable);
  }

  .btn-lg {
    padding: 0 var(--space-6);
    font-size: var(--text-base);
    border-radius: var(--radius-md);
    height: 56px;
  }

  /* ═══════════════════════════════════════════════════════════════
     PRIMARY VARIANT
     ═══════════════════════════════════════════════════════════════ */

  .btn-primary {
    background: var(--text-primary);
    color: var(--text-inverse);
    box-shadow: var(--shadow-button);
  }

  /* Gradient overlay for premium feel */
  .btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12) 0%,
      transparent 50%
    );
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .btn-primary:not(:disabled):hover {
    background: var(--accent-soft);
  }

  .btn-primary:not(:disabled):hover::before {
    opacity: 0.6;
  }

  .btn-primary:not(:disabled):active {
    transform: scale(0.98);
    background: #d4d4d8;
  }

  /* ═══════════════════════════════════════════════════════════════
     SECONDARY VARIANT
     ═══════════════════════════════════════════════════════════════ */

  .btn-secondary {
    background: transparent;
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .btn-secondary:not(:disabled):hover {
    background: var(--bg-hover);
    box-shadow: inset 0 0 0 1px var(--border-emphasis);
  }

  .btn-secondary:not(:disabled):active {
    transform: scale(0.98);
    background: var(--bg-active);
  }

  /* ═══════════════════════════════════════════════════════════════
     GHOST VARIANT
     ═══════════════════════════════════════════════════════════════ */

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
  }

  .btn-ghost:not(:disabled):hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn-ghost:not(:disabled):active {
    transform: scale(0.98);
    background: var(--bg-active);
  }

  /* ═══════════════════════════════════════════════════════════════
     DANGER VARIANT
     ═══════════════════════════════════════════════════════════════ */

  .btn-danger {
    background: var(--error);
    color: white;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .btn-danger::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.15) 0%,
      transparent 50%
    );
    pointer-events: none;
  }

  .btn-danger:not(:disabled):hover {
    background: var(--error-soft);
  }

  .btn-danger:not(:disabled):active {
    transform: scale(0.98);
    background: #b91c1c;
  }

  /* ═══════════════════════════════════════════════════════════════
     FULL WIDTH
     ═══════════════════════════════════════════════════════════════ */

  .full-width {
    width: 100%;
  }
</style>
