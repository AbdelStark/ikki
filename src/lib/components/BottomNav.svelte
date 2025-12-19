<script lang="ts">
  import { Home, Clock, Settings } from "lucide-svelte";
  import { ui, currentView } from "../stores/ui";

  const navItems = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "history" as const, icon: Clock, label: "Activity" },
    { id: "settings" as const, icon: Settings, label: "Settings" },
  ];
</script>

<nav class="nav">
  <div class="nav-bg"></div>
  <div class="nav-container">
    {#each navItems as item}
      <button
        class="nav-item"
        class:active={$currentView === item.id}
        onclick={() => ui.navigate(item.id)}
        aria-label={item.label}
        aria-current={$currentView === item.id ? "page" : undefined}
      >
        <div class="nav-icon-wrap">
          {#if $currentView === item.id}
            <div class="active-indicator"></div>
          {/if}
          <div class="nav-icon">
            <item.icon size={22} strokeWidth={$currentView === item.id ? 2 : 1.5} />
          </div>
        </div>
        <span class="nav-label">{item.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding-bottom: var(--safe-bottom);
  }

  .nav-bg {
    position: absolute;
    inset: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-subtle);
  }

  /* Glass effect overlay */
  .nav-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.02) 0%,
      transparent 100%
    );
    pointer-events: none;
  }

  /* Top shine line */
  .nav-bg::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.04),
      transparent
    );
  }

  .nav-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-around;
    height: var(--nav-height);
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 var(--space-4);
  }

  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    color: var(--text-muted);
    transition:
      color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }

  .nav-item:active {
    transform: scale(0.92);
  }

  .nav-item.active {
    color: var(--text-primary);
  }

  .nav-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 32px;
  }

  .active-indicator {
    position: absolute;
    inset: 0;
    background: var(--accent-muted);
    border-radius: var(--radius-md);
    animation: scaleIn var(--duration-fast) var(--ease-spring);
  }

  /* Subtle glow for active state */
  .active-indicator::after {
    content: '';
    position: absolute;
    inset: -2px;
    background: radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0.06) 0%,
      transparent 70%
    );
    border-radius: inherit;
    pointer-events: none;
  }

  .nav-icon {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-label {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    letter-spacing: var(--tracking-wide);
    transition: color var(--duration-fast) var(--ease-out);
  }

  .nav-item.active .nav-label {
    font-weight: var(--font-semibold);
  }
</style>
