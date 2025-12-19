<script lang="ts">
  import { ChevronDown, Search } from "lucide-svelte";
  import type { Asset } from "../types/swap";

  export let assets: Asset[] = [];
  export let selected: Asset | null = null;
  export let onSelect: (asset: Asset) => void = () => {};
  export let disabled: boolean = false;

  let open = false;
  let search = "";

  $: filteredAssets = assets.filter(
    (a) =>
      a.symbol.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.chain.toLowerCase().includes(search.toLowerCase())
  );

  // Group by chain
  $: groupedAssets = filteredAssets.reduce(
    (acc, asset) => {
      if (!acc[asset.chain]) acc[asset.chain] = [];
      acc[asset.chain].push(asset);
      return acc;
    },
    {} as Record<string, Asset[]>
  );

  function handleSelect(asset: Asset) {
    onSelect(asset);
    open = false;
    search = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      search = "";
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="selector" class:open class:disabled>
  <button
    class="selector-trigger"
    onclick={() => !disabled && (open = !open)}
    {disabled}
  >
    {#if selected}
      <span class="asset-symbol">{selected.symbol}</span>
      <span class="asset-chain">{selected.chain}</span>
    {:else}
      <span class="placeholder">Select asset</span>
    {/if}
    <ChevronDown size={16} class="chevron" />
  </button>

  {#if open}
    <div class="dropdown">
      <div class="search-wrap">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search assets..."
          bind:value={search}
          class="search-input"
        />
      </div>

      <div class="asset-list">
        {#each Object.entries(groupedAssets) as [chain, chainAssets]}
          <div class="chain-group">
            <div class="chain-header">{chain}</div>
            {#each chainAssets as asset}
              <button
                class="asset-item"
                class:selected={selected?.identifier === asset.identifier}
                onclick={() => handleSelect(asset)}
              >
                <span class="asset-symbol">{asset.symbol}</span>
                <span class="asset-name">{asset.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="no-results">No assets found</div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .selector {
    position: relative;
  }

  .selector.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .selector-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color var(--duration-fast) var(--ease-out);
    min-width: 120px;
    font-family: var(--font-sans);
  }

  .selector-trigger:hover {
    border-color: var(--border-hover);
  }

  .selector.open .selector-trigger {
    border-color: var(--accent);
  }

  .asset-symbol {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }

  .asset-chain {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
  }

  .placeholder {
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  .selector-trigger :global(.chevron) {
    margin-left: auto;
    color: var(--text-tertiary);
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .selector.open .selector-trigger :global(.chevron) {
    transform: rotate(180deg);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    right: 0;
    min-width: 200px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 50;
    max-height: 300px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .search-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
    color: var(--text-tertiary);
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: var(--font-sans);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .asset-list {
    overflow-y: auto;
    flex: 1;
  }

  .chain-group {
    padding: var(--space-1) 0;
  }

  .chain-header {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-2xs);
    font-weight: var(--font-semibold);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .asset-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
    text-align: left;
    font-family: var(--font-sans);
  }

  .asset-item:hover {
    background: var(--bg-hover);
  }

  .asset-item.selected {
    background: var(--accent-muted);
  }

  .asset-item .asset-symbol {
    font-size: var(--text-sm);
  }

  .asset-name {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .no-results {
    padding: var(--space-4);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }
</style>
