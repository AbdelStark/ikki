<script lang="ts">
  import { Loader2, Search, SlidersHorizontal, X, ChevronDown, ArrowUpDown, ArrowLeft } from "lucide-svelte";
  import { ui } from "../lib/stores/ui";
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

<div class="history noise-overlay">
  <header class="history-header">
    <button class="back-btn" onclick={() => ui.navigate("home")} aria-label="Back to home">
      <ArrowLeft size={20} strokeWidth={1.5} />
    </button>
    <h1>Activity</h1>
    {#if visibleCount > 0}
      <span class="tx-count">{visibleCount}</span>
    {:else}
      <div class="header-spacer"></div>
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
            <button class="clear-search" onclick={() => (searchQuery = "")} aria-label="Clear search">
              <X size={14} />
            </button>
          {/if}
        </div>

        <button
          class="filter-toggle"
          class:active={filtersExpanded || activeFilterCount > 0}
          onclick={() => filtersExpanded = !filtersExpanded}
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
              <button class="clear-filters" onclick={clearAllFilters}>
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
                  onclick={() => (typeFilter = option.value)}
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
                  onclick={() => (statusFilter = option.value)}
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
                  onclick={() => (sortOption = option.value)}
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
              <button onclick={() => typeFilter = "all"}><X size={10} /></button>
            </span>
          {/if}
          {#if statusFilter !== "all"}
            <span class="active-tag">
              {statusOptions.find(o => o.value === statusFilter)?.label}
              <button onclick={() => statusFilter = "all"}><X size={10} /></button>
            </span>
          {/if}
          {#if sortOption !== "newest"}
            <span class="active-tag">
              {sortOptions.find(o => o.value === sortOption)?.label}
              <button onclick={() => sortOption = "newest"}><X size={10} /></button>
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
    background: linear-gradient(
      180deg,
      var(--bg-primary) 0%,
      rgba(8, 8, 10, 1) 100%
    );
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    gap: var(--space-3);
    animation: floatIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .back-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-lg);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
  }

  .back-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .back-btn:active {
    transform: scale(0.9);
    background: rgba(255, 255, 255, 0.06);
  }

  .history-header h1 {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    letter-spacing: 0.02em;
    text-align: center;
  }

  .tx-count {
    font-size: 10px;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.04);
    padding: 5px 12px;
    border-radius: var(--radius-full);
    border: 1px solid rgba(255, 255, 255, 0.06);
    letter-spacing: 0.05em;
    min-width: 36px;
    text-align: center;
  }

  .header-spacer {
    width: 36px;
  }

  .history-content {
    flex: 1;
    padding: 0 var(--space-5) var(--space-6);
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.1s;
    opacity: 0;
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
    background: linear-gradient(
      145deg,
      rgba(20, 20, 22, 0.8) 0%,
      rgba(15, 15, 17, 0.9) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-xl);
    padding: 14px var(--space-4);
    color: var(--text-muted);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .search-bar:focus-within {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 0 0 3px rgba(255, 255, 255, 0.03),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
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
    width: 48px;
    height: 48px;
    background: linear-gradient(
      145deg,
      rgba(20, 20, 22, 0.8) 0%,
      rgba(15, 15, 17, 0.9) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-xl);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .filter-toggle:hover {
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.02);
  }

  .filter-toggle.active {
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.1);
    background: linear-gradient(
      145deg,
      rgba(25, 25, 28, 0.9) 0%,
      rgba(18, 18, 20, 0.95) 100%
    );
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
    background: linear-gradient(
      180deg,
      rgba(18, 18, 20, 0.85) 0%,
      rgba(12, 12, 14, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-xl);
    padding: var(--space-5);
    animation: slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .filters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filters-title {
    font-size: 10px;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    letter-spacing: 0.1em;
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
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-tertiary);
    padding: 8px 14px;
    border-radius: var(--radius-full);
    cursor: pointer;
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    letter-spacing: 0.02em;
  }

  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .filter-chip.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
    font-size: 10px;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .group-count {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: var(--font-medium);
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .transaction-list {
    background: linear-gradient(
      180deg,
      rgba(18, 18, 20, 0.7) 0%,
      rgba(12, 12, 14, 0.85) 100%
    );
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.04);
    overflow: hidden;
    position: relative;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .transaction-list::before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(255, 255, 255, 0.08),
      transparent
    );
    pointer-events: none;
  }

  .transaction-list > :global(*:not(:last-child)) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
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
