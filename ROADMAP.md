# Ikki Desktop Roadmap

> **Focus**: Usability, Look & Feel, Robustness
> **Target Platform**: Desktop (macOS, Windows, Linux)
> **Status**: Testnet only

This roadmap outlines the next three milestones to bring Ikki to production-ready status with an exceptional user experience.

---

## Milestone 1: Foundation Polish

**Goal**: Make every existing feature rock-solid and complete unfinished work.

### 1.1 Complete Missing Features

- [ ] **Seed phrase display in Settings** - Currently shows placeholder text
- [ ] **Transaction memo display** - Show full memo in transaction detail view
- [ ] **Address derivation display** - Show multiple addresses with derivation paths
- [ ] **Export transaction history** - CSV/JSON export for accounting

### 1.2 Error Handling & Recovery

- [ ] **Network error recovery** - Automatic retry with exponential backoff for lightwalletd connections
- [ ] **Graceful offline mode** - Clear UI state when network is unavailable, queue actions for when online
- [ ] **Sync failure recovery** - Better error messages with actionable recovery steps
- [ ] **Transaction failure details** - Show specific failure reasons (insufficient funds, invalid address, network issues)

### 1.3 Input Validation & Safety

- [ ] **Address validation feedback** - Real-time validation with clear error messages for invalid addresses
- [ ] **Amount validation** - Prevent sending more than balance, handle dust amounts
- [ ] **Memo length indicator** - Show remaining characters (512 byte limit)
- [ ] **Seed phrase validation** - Validate BIP39 words as user types during import

### 1.4 Sync Reliability

- [ ] **Persistent sync state** - Resume sync from last known position after app restart
- [ ] **Sync progress persistence** - Store progress to survive app crashes
- [ ] **Background sync improvements** - Better handling of long-running syncs
- [ ] **Sync cancellation cleanup** - Proper resource cleanup when sync is cancelled

### 1.5 Loading & Feedback States

- [ ] **Skeleton loaders everywhere** - Consistent loading states across all views
- [ ] **Progress indicators for long operations** - Proof generation, broadcast, initial sync
- [ ] **Optimistic UI updates** - Immediately reflect pending transactions in balance

---

## Milestone 2: UX Excellence

**Goal**: Elevate the user experience with thoughtful interactions and missing conveniences.

### 2.1 Send Flow Enhancements

- [ ] **QR code scanning** - Camera integration to scan recipient addresses
- [ ] **Address paste detection** - Auto-detect Zcash addresses from clipboard
- [ ] **Recent recipients** - Quick select from previously sent addresses
- [ ] **Send confirmation haptics** - Tactile feedback on successful send (where supported)
- [ ] **Amount in USD** - Show fiat equivalent while entering amount

### 2.2 Receive Flow Enhancements

- [ ] **QR code with amount** - Generate payment requests with pre-filled amounts
- [ ] **Share address** - Native share sheet integration
- [ ] **Multiple address types** - Easy toggle between unified/sapling/transparent
- [ ] **Address label support** - Name addresses for easier identification

### 2.3 Transaction History Improvements

- [ ] **Search transactions** - Search by memo, address, amount, or txid
- [ ] **Filter by type** - Sent/received/pending filters
- [ ] **Date range filtering** - Filter transactions by date
- [ ] **Sort options** - By date, amount, status
- [ ] **Infinite scroll** - Virtualized list for large transaction histories

### 2.4 Contacts & Address Book

- [ ] **Contact avatars** - Generate identicons or allow custom images
- [ ] **Contact notes** - Add notes to contacts
- [ ] **Contact categories/tags** - Organize contacts into groups
- [ ] **Import/export contacts** - Backup and restore address book

### 2.5 Accessibility & Navigation

- [ ] **Full keyboard navigation** - Tab through all interactive elements
- [ ] **Screen reader support** - ARIA labels and roles
- [ ] **Focus indicators** - Clear visual focus states
- [ ] **Reduced motion mode** - Respect system preference for reduced motion
- [ ] **High contrast mode** - Accessible color alternatives

### 2.6 Preferences & Customization

- [ ] **Hide balance toggle** - Already exists, ensure it's discoverable
- [ ] **Default memo** - Set a default memo for all transactions
- [ ] **Currency display** - Choose fiat currency for conversion
- [ ] **Language selection** - i18n groundwork

---

## Milestone 3: Production Ready

**Goal**: Security hardening, performance optimization, and final polish for mainnet launch.

### 3.1 Security Hardening

- [ ] **App lock** - PIN/password protection on app launch
- [ ] **Biometric unlock** - TouchID/FaceID/Windows Hello integration
- [ ] **Auto-lock timeout** - Lock after inactivity period
- [ ] **Secure clipboard** - Clear clipboard after copying sensitive data
- [ ] **Memory protection** - Clear sensitive data from memory when not needed
- [ ] **Secure storage audit** - Verify seed phrase storage security

### 3.2 Network Configuration

- [ ] **Custom lightwalletd server** - Allow users to specify their own server
- [ ] **Server health indicator** - Show connection status and latency
- [ ] **Mainnet/Testnet toggle** - Easy network switching (with appropriate warnings)
- [ ] **Tor support** - Optional Tor routing for enhanced privacy

### 3.3 Performance Optimization

- [ ] **Startup time optimization** - Target < 2s to interactive
- [ ] **Memory usage audit** - Identify and fix memory leaks
- [ ] **Sync performance** - Optimize batch processing
- [ ] **UI thread optimization** - Ensure all heavy work is off main thread
- [ ] **Bundle size optimization** - Tree-shaking, code splitting

### 3.4 Final Visual Polish

- [ ] **App icon refinement** - Production-ready icon set
- [ ] **Splash screen** - Branded loading experience
- [ ] **Empty state illustrations** - Custom graphics for empty states
- [ ] **Success animations** - Celebratory animations for completed transactions
- [ ] **Micro-interaction audit** - Consistent hover/active/focus states

### 3.5 Testing & Quality

- [ ] **Unit test coverage** - Core wallet logic, stores, utilities
- [ ] **Component tests** - All UI components with edge cases
- [ ] **E2E test suite** - Critical user journeys
- [ ] **Manual QA checklist** - Comprehensive testing before release
- [ ] **Beta testing program** - Gather user feedback before mainnet

### 3.6 Release Preparation

- [ ] **Code signing** - Proper signing for all platforms
- [ ] **Auto-updater** - Seamless updates via Tauri updater
- [ ] **Crash reporting** - Privacy-preserving error reporting
- [ ] **Release notes template** - Changelog format
- [ ] **Documentation** - User guide, FAQ, troubleshooting

---

## Current State Assessment

### What's Working Well
- Premium visual design with gradients, shadows, and blur effects
- Smooth animations and micro-interactions
- Clean component architecture
- Background transaction processing
- Pending transaction tracking
- Price display with sparkline chart

### Known Issues to Address
- Seed phrase display not implemented in Settings
- Source code link points to wrong repository
- No address validation feedback
- Sync can feel unresponsive for large histories

### Technical Debt
- Duplicate sync polling logic (Home.svelte, Settings.svelte)
- Some hardcoded values (fee amount, server URL)
- Missing TypeScript strict mode in some areas

---

## Timeline Philosophy

This roadmap intentionally omits time estimates. Each milestone represents a coherent set of features that should be completed before moving to the next. The pace depends on:

- Contributor availability
- User feedback priorities
- Upstream Zcash library changes
- Security considerations

Focus on quality over speed. Ship when ready, not when scheduled.

---

## Contributing

Pick any unchecked item and submit a PR. For larger features, open an issue first to discuss approach. All contributions should:

1. Follow existing code patterns
2. Include appropriate tests
3. Update documentation if needed
4. Not introduce regressions

See `CLAUDE.md` for detailed coding guidelines.
