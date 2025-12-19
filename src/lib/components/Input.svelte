<script lang="ts">
  export let type: "text" | "number" | "password" = "text";
  export let value: string = "";
  export let placeholder: string = "";
  export let label: string = "";
  export let error: string = "";
  export let disabled: boolean = false;
  export let readonly: boolean = false;
  export let inputmode: "text" | "decimal" | "numeric" = "text";
  export let oninput: (e: Event) => void = () => {};
</script>

<div class="input-wrapper" class:has-error={error}>
  {#if label}
    <label class="input-label" for={label.toLowerCase().replace(/\s+/g, '-')}>{label}</label>
  {/if}
  <div class="input-container">
    <input
      class="input"
      id={label ? label.toLowerCase().replace(/\s+/g, '-') : undefined}
      {type}
      {value}
      {placeholder}
      {disabled}
      {readonly}
      {inputmode}
      {oninput}
    />
    <div class="input-border"></div>
  </div>
  {#if error}
    <span class="input-error">{error}</span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .input-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    padding-left: var(--space-0-5);
  }

  .input-container {
    position: relative;
  }

  .input {
    width: 100%;
    padding: 0 var(--space-4);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 16px; /* Prevents iOS zoom */
    font-weight: var(--font-normal);
    letter-spacing: var(--tracking-normal);
    height: 52px;
    -webkit-appearance: none;
    appearance: none;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  /* Premium gradient overlay */
  .input-container::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-md);
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.02) 0%,
      transparent 50%
    );
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .input-container:has(.input:focus)::before {
    opacity: 1;
  }

  /* Focus glow ring */
  .input-border {
    position: absolute;
    inset: -1px;
    border-radius: calc(var(--radius-md) + 1px);
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .input:focus ~ .input-border {
    opacity: 1;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.04);
  }

  .input::placeholder {
    color: var(--text-muted);
  }

  .input:hover:not(:disabled):not(:focus) {
    border-color: var(--border-emphasis);
  }

  .input:focus {
    outline: none;
    border-color: var(--border-focus);
    background: var(--bg-secondary);
  }

  .input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .input:read-only {
    background: var(--bg-card);
    cursor: default;
  }

  /* Error state */
  .has-error .input {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .has-error .input:focus {
    border-color: var(--error);
  }

  .has-error .input:focus ~ .input-border {
    box-shadow: 0 0 0 3px var(--error-muted);
  }

  .input-error {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--error);
    letter-spacing: var(--tracking-wide);
    padding-left: var(--space-0-5);
    animation: fadeIn var(--duration-fast) var(--ease-out);
  }
</style>
