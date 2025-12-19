<script lang="ts">
  import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-svelte";
  import { ui, type Toast } from "../stores/ui";

  export let toast: Toast;

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  $: Icon = icons[toast.type] || Info;
</script>

<div class="toast toast-{toast.type}" role="alert">
  <div class="toast-icon-wrap">
    <div class="toast-icon">
      <Icon size={16} strokeWidth={2.5} />
    </div>
  </div>
  <span class="toast-message">{toast.message}</span>
  <button class="toast-dismiss" onclick={() => ui.dismissToast(toast.id)} aria-label="Dismiss">
    <X size={14} strokeWidth={2} />
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    animation: fadeInUp var(--duration-normal) var(--ease-out);
    position: relative;
    overflow: hidden;
  }

  /* Premium gradient overlay */
  .toast::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.03) 0%,
      transparent 50%
    );
    pointer-events: none;
  }

  /* Top shine */
  .toast::after {
    content: '';
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.06),
      transparent
    );
  }

  .toast-icon-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
  }

  /* Success toast */
  .toast-success .toast-icon {
    background: var(--success-muted);
    color: var(--success);
  }

  .toast-success {
    border-color: rgba(34, 197, 94, 0.15);
  }

  /* Error toast */
  .toast-error .toast-icon {
    background: var(--error-muted);
    color: var(--error);
  }

  .toast-error {
    border-color: rgba(239, 68, 68, 0.15);
  }

  /* Warning toast */
  .toast-warning .toast-icon {
    background: var(--warning-muted);
    color: var(--warning);
  }

  .toast-warning {
    border-color: rgba(245, 158, 11, 0.15);
  }

  /* Info toast */
  .toast-info .toast-icon {
    background: var(--accent-subtle);
    color: var(--text-secondary);
  }

  .toast-message {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-normal);
    position: relative;
  }

  .toast-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    position: relative;
    transition:
      background var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .toast-dismiss:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .toast-dismiss:active {
    background: var(--bg-active);
  }
</style>
