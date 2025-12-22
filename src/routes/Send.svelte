<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowLeft, Check, Loader2, Users, Clock } from "lucide-svelte";
  import { send, sendPhase, sendAmount, sendAddress, sendMemo, sendTxid, sendError, canProceed } from "../lib/stores/send";
  import { balance } from "../lib/stores/wallet";
  import { ui } from "../lib/stores/ui";
  import { pendingTransactions } from "../lib/stores/pendingTransactions";
  import { sendTransactionBackground } from "../lib/utils/tauri";
  import { hideAmounts } from "../lib/stores/preferences";
  import { formatZec, maskedAmount, parseZec, truncateAddress } from "../lib/utils/format";
  import { detectChain, isZcashAddress } from "../lib/services/near-intents";
  import Button from "../lib/components/Button.svelte";
  import Input from "../lib/components/Input.svelte";

  const FEE = 10000; // 0.0001 ZEC in zatoshis
  let selectedContactName: string | null = null;
  let pendingTxId: string | null = null;

  onMount(() => {
    // Check for selected contact from contacts view
    const stored = sessionStorage.getItem("selected_recipient");
    if (stored) {
      try {
        const contact = JSON.parse(stored);
        send.setAddress(contact.address);
        selectedContactName = contact.name;
        sessionStorage.removeItem("selected_recipient");
      } catch {
        // Invalid data, ignore
      }
    }
  });

  function handleAmountInput(e: Event) {
    const target = e.target as HTMLInputElement;
    send.setAmount(target.value);
  }

  function handleAddressInput(e: Event) {
    const target = e.target as HTMLInputElement;
    send.setAddress(target.value);
  }

  function handleMemoInput(e: Event) {
    const target = e.target as HTMLInputElement;
    send.setMemo(target.value);
  }

  function setMaxAmount() {
    const maxZatoshis = Math.max(0, $balance - FEE);
    const maxZec = maxZatoshis / 100_000_000;
    send.setAmount(maxZec.toString());
  }

  function goToPreview() {
    send.setPhase("preview");
  }

  function goBackToInput() {
    send.setPhase("input");
  }

  async function confirmSend() {
    send.setPhase("sending");
    try {
      const amountZatoshis = parseZec($sendAmount);
      // Start background transaction - returns immediately
      const pendingTx = await sendTransactionBackground($sendAddress, amountZatoshis, $sendMemo || undefined);

      // Add to pending transactions store
      pendingTransactions.add(pendingTx);
      pendingTxId = pendingTx.id;

      // Show success - transaction is now being processed in background
      send.setPhase("complete");
      ui.showToast("Transaction initiated", "success");
    } catch (e) {
      send.setError(String(e));
      ui.showToast(`Send failed: ${e}`, "error");
    }
  }

  function handleDone() {
    send.reset();
    ui.navigate("home");
  }

  function handleBack() {
    if ($sendPhase === "preview") {
      goBackToInput();
    } else if ($sendPhase === "input") {
      send.reset();
      ui.navigate("home");
    }
  }

  $: amountZatoshis = parseZec($sendAmount);
  $: totalWithFee = amountZatoshis + FEE;
  $: isHidden = $hideAmounts;
  $: detectedChain = $sendAddress ? detectChain($sendAddress) : null;
  $: isCrossPay = detectedChain !== null && detectedChain !== 'zcash';
</script>

<div class="send noise-overlay">
  {#if $sendPhase !== "complete"}
    <header class="send-header">
      <button class="back-button" onclick={handleBack}>
        <ArrowLeft size={20} strokeWidth={2} />
      </button>
      <h1>Send</h1>
      <div class="header-spacer"></div>
    </header>
  {/if}

  <div class="send-content">
    {#if $sendPhase === "input"}
      <div class="input-phase">
        <div class="balance-display">
          <span class="balance-label">Available</span>
          <span class="balance-value">{isHidden ? maskedAmount() : formatZec($balance)} ZEC</span>
        </div>

        <div class="form-section">
          <div class="amount-input-wrapper">
            <Input
              type="text"
              inputmode="decimal"
              label="Amount"
              placeholder="0.00"
              value={$sendAmount}
              oninput={handleAmountInput}
            />
            <button class="max-button" onclick={setMaxAmount}>MAX</button>
          </div>

          <div class="address-section">
            <div class="address-header">
              <span class="address-label">Recipient Address</span>
              <button class="contacts-link" onclick={() => ui.navigate("contacts")}>
                <Users size={14} />
                Contacts
              </button>
            </div>
            {#if selectedContactName}
              <div class="selected-contact">
                <Users size={12} />
                <span>{selectedContactName}</span>
              </div>
            {/if}
            <Input
              placeholder="Enter Zcash address"
              value={$sendAddress}
              oninput={handleAddressInput}
            />
          </div>

          {#if isCrossPay}
            <div class="crosspay-notice">
              <span class="chain-badge">{detectedChain?.toUpperCase()}</span>
              <div class="crosspay-text">
                <span>This is a {detectedChain} address.</span>
                <span class="crosspay-coming-soon">CrossPay via NEAR Intents coming soon</span>
              </div>
            </div>
          {/if}

          <Input
            label="Memo (optional)"
            placeholder="Add a private note"
            value={$sendMemo}
            oninput={handleMemoInput}
          />
        </div>

        <div class="form-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!$canProceed}
            onclick={goToPreview}
          >
            Review
          </Button>
        </div>
      </div>

    {:else if $sendPhase === "preview"}
      <div class="preview-phase">
        <div class="preview-amount">
          <span class="amount-value">{isHidden ? maskedAmount() : formatZec(amountZatoshis)}</span>
          <span class="amount-currency">ZEC</span>
        </div>

        <div class="preview-card">
          <div class="preview-row">
            <span class="preview-label">To</span>
            <span class="preview-value mono">{truncateAddress($sendAddress, 12)}</span>
          </div>
          <div class="preview-divider"></div>
          <div class="preview-row">
            <span class="preview-label">Amount</span>
            <span class="preview-value">{isHidden ? maskedAmount() : formatZec(amountZatoshis)} ZEC</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">Network fee</span>
            <span class="preview-value secondary">{isHidden ? maskedAmount() : formatZec(FEE)} ZEC</span>
          </div>
          <div class="preview-divider"></div>
          <div class="preview-row total">
            <span class="preview-label">Total</span>
            <span class="preview-value">{isHidden ? maskedAmount() : formatZec(totalWithFee)} ZEC</span>
          </div>
          {#if $sendMemo}
            <div class="preview-divider"></div>
            <div class="preview-row">
              <span class="preview-label">Memo</span>
              <span class="preview-value memo">{$sendMemo}</span>
            </div>
          {/if}
        </div>

        <div class="form-actions">
          <Button variant="primary" size="lg" fullWidth onclick={confirmSend}>
            Confirm Send
          </Button>
          <Button variant="ghost" size="lg" fullWidth onclick={goBackToInput}>
            Edit
          </Button>
        </div>
      </div>

    {:else if $sendPhase === "sending"}
      <div class="status-phase">
        <div class="status-icon spinning">
          <Loader2 size={32} class="spin" />
        </div>
        <h2>Sending</h2>
        <p>Broadcasting transaction to the network...</p>
      </div>

    {:else if $sendPhase === "complete"}
      <div class="status-phase">
        <div class="status-icon processing">
          <Clock size={28} strokeWidth={2} />
        </div>
        <h2>Transaction Initiated</h2>
        <p class="processing-message">
          Your transaction is being built and will be broadcast shortly. You can safely navigate away.
        </p>
        <div class="processing-info">
          <div class="processing-dot"></div>
          <span>Processing in background</span>
        </div>
        <div class="form-actions wide">
          <Button variant="primary" size="lg" fullWidth onclick={handleDone}>
            Done
          </Button>
          <Button variant="ghost" size="lg" fullWidth onclick={() => ui.navigate("history")}>
            View Activity
          </Button>
        </div>
      </div>

    {:else if $sendPhase === "error"}
      <div class="status-phase">
        <div class="status-icon error">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <h2>Failed</h2>
        <p class="error-text">{$sendError}</p>
        <div class="form-actions wide">
          <Button variant="primary" size="lg" fullWidth onclick={goBackToInput}>
            Try Again
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .send {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      180deg,
      var(--bg-primary) 0%,
      rgba(8, 8, 10, 1) 100%
    );
  }

  .send-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    animation: floatIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .back-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .back-button:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .back-button:active {
    transform: scale(0.9);
    background: rgba(255, 255, 255, 0.06);
  }

  .send-header h1 {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    letter-spacing: 0.02em;
  }

  .header-spacer {
    width: 36px;
  }

  .send-content {
    flex: 1;
    padding: var(--space-5);
    max-width: var(--max-width);
    margin: 0 auto;
    width: 100%;
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.1s;
    opacity: 0;
  }

  /* Input Phase */
  .input-phase {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-height: 100%;
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.05s;
    opacity: 0;
  }

  .balance-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background: linear-gradient(
      145deg,
      rgba(20, 20, 22, 0.7) 0%,
      rgba(15, 15, 17, 0.8) 100%
    );
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.03);
    position: relative;
    overflow: hidden;
  }

  .balance-display::before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(255, 255, 255, 0.06),
      transparent
    );
    pointer-events: none;
  }

  .balance-label {
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .balance-value {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.08);
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .address-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .address-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .address-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .contacts-link {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1-5) var(--space-2-5);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .contacts-link:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .contacts-link:active {
    transform: scale(0.95);
  }

  .selected-contact {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0.02) 100%
    );
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--text-2xs);
    font-weight: var(--font-medium);
    border: 1px solid rgba(255, 255, 255, 0.06);
    animation: fadeIn 0.3s ease;
  }

  .amount-input-wrapper {
    position: relative;
  }

  .max-button {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(20%);
    padding: 6px 12px;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.04) 100%
    );
    color: var(--text-secondary);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    font-size: 9px;
    font-weight: var(--font-bold);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    letter-spacing: var(--tracking-widest);
    -webkit-tap-highlight-color: transparent;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .max-button:hover {
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.9) 100%
    );
    color: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow:
      0 4px 12px rgba(255, 255, 255, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .max-button:active {
    transform: translateY(20%) scale(0.92);
  }

  .form-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: auto;
    padding-top: var(--space-6);
  }

  .form-actions.wide {
    width: 100%;
    padding: var(--space-6) var(--space-4) 0;
  }

  /* Preview Phase */
  .preview-phase {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .preview-amount {
    text-align: center;
    padding: var(--space-8) 0 var(--space-6);
    position: relative;
  }

  .preview-amount::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 100px;
    background: radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 60%
    );
    pointer-events: none;
    animation: glowPulse 3s ease-in-out infinite;
  }

  .amount-value {
    font-size: 2.5rem;
    font-weight: var(--font-bold);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    position: relative;
    text-shadow:
      0 0 40px rgba(255, 255, 255, 0.1),
      0 0 20px rgba(255, 255, 255, 0.05);
  }

  .amount-currency {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    margin-left: var(--space-2);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    position: relative;
  }

  .preview-card {
    background: linear-gradient(
      180deg,
      rgba(18, 18, 20, 0.7) 0%,
      rgba(12, 12, 14, 0.85) 100%
    );
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: var(--space-5);
    position: relative;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .preview-card::before {
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

  .preview-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--space-2) 0;
    position: relative;
  }

  .preview-row.total {
    padding-top: var(--space-3);
  }

  .preview-row.total .preview-label,
  .preview-row.total .preview-value {
    font-weight: var(--font-semibold);
  }

  .preview-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    letter-spacing: var(--tracking-wide);
  }

  .preview-value {
    font-size: var(--text-xs);
    color: var(--text-primary);
    text-align: right;
    max-width: 60%;
    word-break: break-all;
    letter-spacing: var(--tracking-wide);
  }

  .preview-value.mono {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
  }

  .preview-value.secondary {
    color: var(--text-tertiary);
  }

  .preview-value.memo {
    font-style: italic;
    color: var(--text-secondary);
  }

  .preview-divider {
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.06) 20%,
      rgba(255, 255, 255, 0.06) 80%,
      transparent 100%
    );
    margin: var(--space-2) 0;
  }

  /* Status Phases */
  .status-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-16) var(--space-4);
    gap: var(--space-4);
    min-height: 60vh;
    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .status-icon {
    width: 80px;
    height: 80px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-2);
    position: relative;
  }

  .status-icon::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: var(--radius-full);
    background: radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 70%
    );
    animation: glowPulse 3s ease-in-out infinite;
  }

  .status-icon.spinning {
    background: linear-gradient(
      145deg,
      rgba(25, 25, 28, 0.9) 0%,
      rgba(18, 18, 20, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .status-icon.spinning :global(.spin) {
    animation: spin 1s linear infinite;
  }

  .status-icon.success {
    background: linear-gradient(
      145deg,
      rgba(52, 211, 153, 0.15) 0%,
      rgba(52, 211, 153, 0.08) 100%
    );
    border: 1px solid rgba(52, 211, 153, 0.25);
    color: var(--receive);
    animation: scaleIn var(--duration-normal) var(--ease-spring);
    box-shadow:
      0 4px 20px rgba(52, 211, 153, 0.15),
      inset 0 1px 0 rgba(52, 211, 153, 0.2);
  }

  .status-icon.processing {
    background: linear-gradient(
      145deg,
      rgba(25, 25, 28, 0.9) 0%,
      rgba(18, 18, 20, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    animation: scaleIn var(--duration-normal) var(--ease-spring);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .processing-message {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    max-width: 280px;
    line-height: var(--leading-relaxed);
    text-align: center;
  }

  .processing-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2-5) var(--space-4);
    background: linear-gradient(
      145deg,
      rgba(20, 20, 22, 0.8) 0%,
      rgba(15, 15, 17, 0.9) 100%
    );
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: var(--space-2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .processing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.4) 0%,
      rgba(255, 255, 255, 0.2) 100%
    );
    animation: pulse 1.5s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
  }

  .processing-info span {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    letter-spacing: var(--tracking-wide);
  }

  .status-icon.error {
    background: linear-gradient(
      145deg,
      rgba(239, 68, 68, 0.15) 0%,
      rgba(239, 68, 68, 0.08) 100%
    );
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: var(--error);
    animation: scaleIn var(--duration-normal) var(--ease-spring);
    box-shadow:
      0 4px 20px rgba(239, 68, 68, 0.15),
      inset 0 1px 0 rgba(239, 68, 68, 0.2);
  }

  .status-phase h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tight);
    text-shadow: 0 0 30px rgba(255, 255, 255, 0.08);
  }

  .status-phase p {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    max-width: 260px;
    line-height: var(--leading-relaxed);
  }

  .txid-badge {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: var(--text-tertiary);
    background: linear-gradient(
      145deg,
      rgba(20, 20, 22, 0.8) 0%,
      rgba(15, 15, 17, 0.9) 100%
    );
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.05);
    letter-spacing: var(--tracking-wide);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .error-text {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    max-width: 280px;
    line-height: var(--leading-relaxed);
  }

  /* Preview Phase Animation */
  .preview-phase {
    animation: floatIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* CrossPay Notice */
  .crosspay-notice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--accent-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    animation: fadeIn var(--duration-fast) var(--ease-out);
  }

  .chain-badge {
    padding: var(--space-1) var(--space-2);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-weight: var(--font-semibold);
    font-size: var(--text-2xs);
    color: var(--text-primary);
    letter-spacing: var(--tracking-wider);
    white-space: nowrap;
  }

  .crosspay-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-xs);
  }

  .crosspay-text > span:first-child {
    color: var(--text-secondary);
    font-weight: var(--font-medium);
  }

  .crosspay-coming-soon {
    color: var(--text-tertiary);
    font-size: var(--text-2xs);
    font-style: italic;
  }
</style>
