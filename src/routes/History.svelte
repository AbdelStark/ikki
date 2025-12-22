<script lang="ts">
  import { Loader2, Search, SlidersHorizontal, X, ChevronDown, ArrowUpDown } from "lucide-svelte";
  import { type Transaction } from "../lib/utils/tauri";
  import { pendingTxList } from "../lib/stores/pendingTransactions";
  import { transactions as txStore, transactionsLoading, transactionsLoaded } from "../lib/stores/transactions";
  import TransactionItem from "../lib/components/TransactionItem.svelte";
  import PendingTransactionItem from "../lib/components/PendingTransactionItem.svelte";

  // Use global transactions store
  $: transactions = $txStore;
  $: loading = !$transactionsLoaded;
  let error: string | null = null;
  let searchQuery = "";
  let filtersExpanded = false;
  type TransactionTypeFilter = "all" | Transaction["tx_type"];
  type TransactionStatusFilter = "all" | Transaction["status"];
  type SortOption = "newest" | "oldest" | "amount-high" | "amount-low";

  let typeFilter: TransactionTypeFilter = "all";
  let statusFilter: TransactionStatusFilter = "all";
  let sortOption: SortOption = "newest";

  // Count active filters (excluding defaults)
  $: activeFilterCount = (typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (sortOption !== "newest" ? 1 : 0);

  function clearAllFilters() {
    typeFilter = "all";
    statusFilter = "all";
    sortOption = "newest";
  }

  const typeOptions: { value: TransactionTypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "received", label: "Received" },
    { value: "sent", label: "Sent" },
    { value: "shielding", label: "Shielded" },
    { value: "internal", label: "Internal" },
  ];

  const statusOptions: { value: TransactionStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "confirmed", label: "Confirmed" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
  ];

  const sortOptions = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "amount-high", label: "Amount: high to low" },
    { value: "amount-low", label: "Amount: low to high" },
  ];

  interface GroupedTransactions {
    label: string;
    transactions: Transaction[];
  }

  function matchesSearchTerm(value: string | null | undefined, term: string): boolean {
    return (value ?? "").toLowerCase().includes(term);
  }

  function filterTransactions(
    txs: Transaction[],
    term: string,
    type: TransactionTypeFilter,
    status: TransactionStatusFilter
  ): Transaction[] {
    return txs.filter((tx) => {
      const matchesType = type === "all" || tx.tx_type === type;
      const matchesStatus = status === "all" || tx.status === status;
      const matchesSearch =
        term.length === 0 ||
        [tx.txid, tx.address, tx.memo, tx.tx_type, tx.status].some((field) =>
          matchesSearchTerm(field, term)
        );

      return matchesType && matchesStatus && matchesSearch;
    });
  }

  function sortTransactions(txs: Transaction[], option: SortOption): Transaction[] {
    const sorted = [...txs];

    sorted.sort((a, b) => {
      if (option === "newest") return b.timestamp - a.timestamp;
      if (option === "oldest") return a.timestamp - b.timestamp;

      const aAmount = Math.abs(a.amount);
      const bAmount = Math.abs(b.amount);

      if (option === "amount-high") return bAmount - aAmount || b.timestamp - a.timestamp;
      if (option === "amount-low") return aAmount - bAmount || b.timestamp - a.timestamp;

      return 0;
    });

    return sorted;
  }

  function groupTransactionsByDate(txs: Transaction[]): GroupedTransactions[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(thisMonth.getDate() - 30);

    const groups: { [key: string]: Transaction[] } = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      "This Month": [],
      Earlier: [],
    };

    for (const tx of txs) {
      const txDate = new Date(tx.timestamp * 1000);
      if (txDate >= today) {
        groups["Today"].push(tx);
      } else if (txDate >= yesterday) {
        groups["Yesterday"].push(tx);
      } else if (txDate >= thisWeek) {
        groups["This Week"].push(tx);
      } else if (txDate >= thisMonth) {
        groups["This Month"].push(tx);
      } else {
        groups["Earlier"].push(tx);
      }
    }

    return Object.entries(groups)
      .filter(([_, txs]) => txs.length > 0)
      .map(([label, transactions]) => ({ label, transactions }));
  }

  $: searchTerm = searchQuery.trim().toLowerCase();
  $: filteredTransactions = filterTransactions(transactions, searchTerm, typeFilter, statusFilter);
  $: sortedTransactions = sortTransactions(filteredTransactions, sortOption);
  $: groupedTransactions = groupTransactionsByDate(sortedTransactions);
  $: filteredPendingTransactions = $pendingTxList.filter((pendingTx) => {
    if (searchTerm.length === 0) return true;

    return [pendingTx.to_address, pendingTx.txid, pendingTx.memo, pendingTx.id].some((field) =>
      matchesSearchTerm(field, searchTerm)
    );
  });
  $: hasAnyActivity = transactions.length > 0 || $pendingTxList.length > 0;
  $: visibleCount = sortedTransactions.length + filteredPendingTransactions.length;
  $: hasResults = visibleCount > 0;
</script>

<div class="history">
  <header class="history-header">
    <h1>Activity</h1>
    {#if visibleCount > 0}
      <span class="tx-count">{visibleCount}</span>
    {/if}
  </header>

  <div class="history-content">
    <div class="search-filters-container">
      <!-- Search Bar Row -->
      <div class="search-row">
        <div class="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            bind:value={searchQuery}
            aria-label="Search transactions"
          />
          {#if searchQuery.length > 0}
            <button class="clear-search" on:click={() => (searchQuery = "")} aria-label="Clear search">
              <X size={14} />
            </button>
          {/if}
        </div>

        <button
          class="filter-toggle"
          class:active={filtersExpanded || activeFilterCount > 0}
          on:click={() => filtersExpanded = !filtersExpanded}
          aria-label="Toggle filters"
          aria-expanded={filtersExpanded}
        >
          <SlidersHorizontal size={16} />
          {#if activeFilterCount > 0}
            <span class="filter-badge">{activeFilterCount}</span>
          {/if}
        </button>
      </div>

      <!-- Collapsible Filters Panel -->
      {#if filtersExpanded}
        <div class="filters-panel" class:expanded={filtersExpanded}>
          <div class="filters-header">
            <span class="filters-title">Filters & Sort</span>
            {#if activeFilterCount > 0}
              <button class="clear-filters" on:click={clearAllFilters}>
                Clear all
              </button>
            {/if}
          </div>

          <div class="filter-section">
            <div class="filter-label">Type</div>
            <div class="chip-row">
              {#each typeOptions as option}
                <button
                  class="filter-chip"
                  class:active={typeFilter === option.value}
                  on:click={() => (typeFilter = option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-label">Status</div>
            <div class="chip-row">
              {#each statusOptions as option}
                <button
                  class="filter-chip"
                  class:active={statusFilter === option.value}
                  on:click={() => (statusFilter = option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-label">
              <ArrowUpDown size={12} />
              <span>Sort by</span>
            </div>
            <div class="chip-row">
              {#each sortOptions as option}
                <button
                  class="filter-chip"
                  class:active={sortOption === option.value}
                  on:click={() => (sortOption = option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- Active Filters Summary (when collapsed) -->
      {#if !filtersExpanded && activeFilterCount > 0}
        <div class="active-filters-summary">
          {#if typeFilter !== "all"}
            <span class="active-tag">
              {typeOptions.find(o => o.value === typeFilter)?.label}
              <button on:click={() => typeFilter = "all"}><X size={10} /></button>
            </span>
          {/if}
          {#if statusFilter !== "all"}
            <span class="active-tag">
              {statusOptions.find(o => o.value === statusFilter)?.label}
              <button on:click={() => statusFilter = "all"}><X size={10} /></button>
            </span>
          {/if}
          {#if sortOption !== "newest"}
            <span class="active-tag">
              {sortOptions.find(o => o.value === sortOption)?.label}
              <button on:click={() => sortOption = "newest"}><X size={10} /></button>
            </span>
          {/if}
        </div>
      {/if}
    </div>

    {#if loading}
      <div class="loading-state">
        <Loader2 size={22} class="spin" />
        <p>Loading transactions</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="error-message">{error}</p>
      </div>
    {:else if !hasAnyActivity}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h3>No transactions yet</h3>
        <p>Your activity will appear here</p>
      </div>
    {:else if !hasResults}
      <div class="empty-state filter-empty">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
        </div>
        <h3>No matching activity</h3>
        <p>Try a different search, filter, or sort option.</p>
      </div>
    {:else}
      <div class="transaction-groups">
        <!-- Pending Transactions -->
        {#if filteredPendingTransactions.length > 0}
          <div class="transaction-group pending-group">
            <div class="group-header">
              <span class="group-label">Processing</span>
              <span class="group-count pending">{filteredPendingTransactions.length}</span>
            </div>
            <div class="transaction-list pending">
              {#each filteredPendingTransactions as pendingTx (pendingTx.id)}
                <PendingTransactionItem {pendingTx} />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Confirmed Transactions -->
        {#each groupedTransactions as group}
          <div class="transaction-group">
            <div class="group-header">
              <span class="group-label">{group.label}</span>
              <span class="group-count">{group.transactions.length}</span>
            </div>
            <div class="transaction-list">
              {#each group.transactions as tx}
                <TransactionItem
                  txid={tx.txid}
                  txType={tx.tx_type}
                  amount={tx.amount}
                  timestamp={tx.timestamp}
                  address={tx.address}
                  memo={tx.memo}
                  status={tx.status}
                  confirmations={tx.confirmations}
                />
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .history {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    animation: fadeIn var(--duration-normal) var(--ease-out);
    background: var(--bg-primary);
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5);
    padding-bottom: var(--space-3);
  }

  .history-header h1 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tight);
  }

  .tx-count {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    background: var(--bg-elevated);
    padding: 4px 10px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border-subtle);
    letter-spacing: var(--tracking-wide);
  }

  .history-content {
    flex: 1;
    padding: 0 var(--space-5) var(--space-5);
    padding-bottom: calc(var(--nav-height) + var(--space-4));
  }

  /* Search and Filters Container */
  .search-filters-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  /* Search Row */
  .search-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .search-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-3) var(--space-4);
    color: var(--text-tertiary);
    transition: border-color var(--duration-fast) var(--ease-out),
                box-shadow var(--duration-fast) var(--ease-out);
  }

  .search-bar:focus-within {
    border-color: var(--border-emphasis);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
  }

  .search-bar input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    outline: none;
  }

  .search-bar input::placeholder {
    color: var(--text-tertiary);
  }

  .clear-search {
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--duration-fast) var(--ease-out),
                background var(--duration-fast) var(--ease-out);
  }

  .clear-search:hover {
    color: var(--text-secondary);
    background: var(--bg-hover);
  }

  /* Filter Toggle Button */
  .filter-toggle {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    flex-shrink: 0;
  }

  .filter-toggle:hover {
    color: var(--text-primary);
    border-color: var(--border-emphasis);
    background: var(--bg-elevated);
  }

  .filter-toggle.active {
    color: var(--text-primary);
    border-color: var(--border-emphasis);
    background: var(--bg-elevated);
  }

  .filter-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    background: var(--accent);
    color: var(--bg-primary);
    font-size: 10px;
    font-weight: var(--font-bold);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  /* Collapsible Filters Panel */
  .filters-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    animation: slideDown var(--duration-normal) var(--ease-out);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .filters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filters-title {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .clear-filters {
    background: none;
    border: none;
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: color var(--duration-fast) var(--ease-out),
                background var(--duration-fast) var(--ease-out);
  }

  .clear-filters:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .filter-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .filter-label {
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wide);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    text-transform: uppercase;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .filter-chip {
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: var(--radius-full);
    cursor: pointer;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .filter-chip:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-emphasis);
  }

  .filter-chip.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  /* Active Filters Summary */
  .active-filters-summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    animation: fadeIn var(--duration-fast) var(--ease-out);
  }

  .active-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    padding: 4px 8px 4px 12px;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .active-tag button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-full);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .active-tag button:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .filter-empty {
    border: 1px dashed var(--border);
    border-radius: var(--radius-lg);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12) 0;
    gap: var(--space-3);
    color: var(--text-tertiary);
  }

  .loading-state :global(.spin) {
    animation: spin 1s linear infinite;
  }

  .loading-state p {
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wide);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12) 0;
    gap: var(--space-3);
    text-align: center;
  }

  .error-icon {
    color: var(--text-tertiary);
    opacity: 0.5;
  }

  .error-message {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    max-width: 280px;
    line-height: var(--leading-relaxed);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12) var(--space-4);
    text-align: center;
    gap: var(--space-3);
  }

  .empty-icon {
    color: var(--text-tertiary);
    opacity: 0.3;
    margin-bottom: var(--space-2);
  }

  .empty-state h3 {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .empty-state p {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }

  .transaction-groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .transaction-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-1);
  }

  .group-label {
    font-size: var(--text-2xs);
    font-weight: var(--font-semibold);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
  }

  .group-count {
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    font-weight: var(--font-medium);
    letter-spacing: var(--tracking-wide);
  }

  .transaction-list {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    overflow: hidden;
    position: relative;
  }

  .transaction-list::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--gradient-card);
    pointer-events: none;
  }

  .transaction-list::after {
    content: '';
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(255, 255, 255, 0.04),
      transparent
    );
  }

  .transaction-list > :global(*:not(:last-child)) {
    border-bottom: 1px solid var(--divider);
  }

  .pending-group {
    animation: fadeIn var(--duration-normal) var(--ease-out);
  }

  .group-count.pending {
    background: var(--bg-card);
    color: var(--text-secondary);
    border-color: var(--border);
    animation: pulse 2s ease-in-out infinite;
  }

  .transaction-list.pending {
    border-color: var(--border-emphasis);
    background: linear-gradient(
      135deg,
      var(--bg-card) 0%,
      rgba(255, 255, 255, 0.02) 100%
    );
  }

  .transaction-list.pending::before {
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.03) 0%,
      transparent 100%
    );
  }
</style>
