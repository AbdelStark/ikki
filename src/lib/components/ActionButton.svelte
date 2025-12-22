<script lang="ts">
  import { ArrowUp, ArrowDown, CreditCard, ArrowLeftRight } from "lucide-svelte";

  export let variant: "send" | "receive" | "buy" | "swap" = "send";
  export let onclick: () => void = () => {};
  export let disabled: boolean = false;

  const config = {
    send: { icon: ArrowUp, label: "Send" },
    receive: { icon: ArrowDown, label: "Receive" },
    buy: { icon: CreditCard, label: "Buy" },
    swap: { icon: ArrowLeftRight, label: "Swap" },
  };

  $: Icon = config[variant].icon;
  $: label = config[variant].label;
</script>

<button
  class="action-button"
  class:send={variant === "send"}
  class:receive={variant === "receive"}
  class:buy={variant === "buy"}
  class:swap={variant === "swap"}
  {disabled}
  {onclick}
>
  <div class="action-icon">
    <div class="icon-bg"></div>
    <div class="icon-content">
      <Icon size={20} strokeWidth={2} />
    </div>
  </div>
  <span class="action-label">{label}</span>
</button>

<style>
  .action-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: var(--space-1);
    background: none;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    min-width: 64px;
  }

  .action-button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  .action-icon {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-full);
  }

  .icon-bg {
    position: absolute;
    inset: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    transition:
      background var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out),
      transform var(--duration-normal) var(--ease-spring),
      box-shadow var(--duration-normal) var(--ease-out);
  }

  /* Gradient overlay for depth */
  .icon-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.02) 40%,
      transparent 100%
    );
    pointer-events: none;
  }

  .icon-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-primary);
    transition: transform var(--duration-fast) var(--ease-out);
  }

  /* Hover states */
  .action-button:not(:disabled):hover .icon-bg {
    background: var(--bg-elevated);
    border-color: var(--border-emphasis);
    transform: translateY(-4px);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.4),
      0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .action-button:not(:disabled):active .icon-bg {
    transform: translateY(-2px) scale(0.96);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .action-button:not(:disabled):active .icon-content {
    transform: scale(0.92);
  }

  /* Send variant hover - subtle red tint */
  .action-button.send:not(:disabled):hover .icon-bg {
    border-color: rgba(239, 68, 68, 0.3);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(239, 68, 68, 0.08);
  }

  /* Receive variant hover - subtle green tint */
  .action-button.receive:not(:disabled):hover .icon-bg {
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(34, 197, 94, 0.08);
  }

  /* Buy variant hover - subtle blue tint */
  .action-button.buy:not(:disabled):hover .icon-bg {
    border-color: rgba(59, 130, 246, 0.3);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(59, 130, 246, 0.08);
  }

  /* Swap variant hover - subtle purple tint */
  .action-button.swap:not(:disabled):hover .icon-bg {
    border-color: rgba(168, 85, 247, 0.3);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(168, 85, 247, 0.08);
  }

  .action-label {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wide);
    transition: color var(--duration-fast) var(--ease-out);
  }

  .action-button:not(:disabled):hover .action-label {
    color: var(--text-primary);
  }
</style>
