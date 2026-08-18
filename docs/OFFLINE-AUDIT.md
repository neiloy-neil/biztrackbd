# Offline System Audit

## Executive Summary
This document outlines the findings of the offline synchronization audit. The offline system is highly rudimentary and exclusively handles write-mutations (inserts) for specific financial transactions. There is absolutely no read-caching implemented, meaning the app is entirely dependent on the network to function initially.

**Critical Finding:** The term "Offline Support" is a misnomer in BizTrack BD. The system does not cache Products, Customers, or Accounts offline. If a user loses connection *while already on the POS screen*, they can continue making sales. If they refresh the page, the application will completely fail to load.

---

## 1. Feature Matrix

| Feature | Offline UI | Local Save | Queue | Sync | Conflict Handling | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **POS Sale** | 🟡 Memory only | 🟢 IndexedDB | 🟢 Yes | 🟢 Yes | 🔴 None (Fails on Insufficient Stock) | Partial |
| **Income** | 🟡 Memory only | 🟢 IndexedDB | 🟢 Yes | 🟢 Yes | 🔴 None | Partial |
| **Expense** | 🟡 Memory only | 🟢 IndexedDB | 🟢 Yes | 🟢 Yes | 🔴 None | Partial |
| **Payment** | 🟡 Memory only | 🟢 IndexedDB | 🟢 Yes | 🟢 Yes | 🔴 None | Partial |
| **Customer** | 🔴 No | 🔴 No | 🔴 No | 🔴 No | 🔴 N/A | Missing |
| **Product** | 🔴 No | 🔴 No | 🔴 No | 🔴 No | 🔴 N/A | Missing |
| **Inventory**| 🔴 No | 🔴 No | 🔴 No | 🔴 No | 🔴 N/A | Missing |

*Note: "Memory only" means the UI will only work if it was already fetched and rendered before the network dropped. Refreshing the page offline results in a fatal Next.js network error.*

---

## 2. Infrastructure Checks

### A. IndexedDB & The Mutation Queue
- **Architecture:** The queue is built on `idb-keyval` and correctly serializes failed/offline server actions into a background queue.
- **Data Scope:** The queue only supports `transaction`, `pos_sale`, and `party_payment`. All other entities (Settings, Customers, Products, Branches) immediately fail when offline.

### B. Syncing & Background Retries
- **Sync Trigger:** The `OfflineSyncProvider` correctly attaches to `window.ononline` and `document.onvisibilitychange` to trigger auto-syncs.
- **Exponential Backoff:** The system correctly implements backoff up to 1 hour, capping at `MAX_RETRIES` (5).
- **Duplicate Prevention:** Safe. The queue utilizes an `idempotencyKey` and gracefully marks transactions as `synced` if the backend throws a "Duplicate/already being processed" error.

### C. Conflict Handling (The "Stock" Problem)
- **The Issue:** There is absolutely no conflict resolution mechanism.
- **The Scenario:** If an offline user sells the last unit of "Item X", and another online user simultaneously sells the last unit of "Item X", the online user succeeds. When the offline user reconnects, their sync fails with an "Insufficient Stock" error.
- **The Result:** The offline sale retries 5 times and then is marked as `failed`. The user must manually navigate to a hidden "Failed syncs" menu, but they cannot resolve the stock issue without deleting the transaction entirely. The cash collected from the customer is now unaccounted for in the ledger because the sale failed.

---

## Conclusion
The offline architecture is essentially a "Resilient Checkout Queue" rather than true Offline Support. It protects against temporary network blips during a sale but cannot facilitate true offline operations due to the lack of IndexedDB read-caching for Products and Accounts. Furthermore, the lack of conflict resolution for inventory means offline sales carry a high risk of ledger divergence.
