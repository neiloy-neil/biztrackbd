# Financial Root Cause Report

This report provides a deep-dive root cause analysis of the financial discrepancies uncovered during the forensic audit of BizTrack BD. The problems are ranked by severity, with complete execution traces mapping the failure points.

---

## Ranking Schema
- **P0** = Financial data can become permanently corrupted, missing, or phantom money created.
- **P1** = Important financial calculations are fundamentally incorrect.
- **P2** = Reporting/display inconsistencies causing user confusion.
- **P3** = Minor aesthetic or non-critical issue.

---

## 1. [P0] Customer Due & Supplier Payable Inflation (Double Counting)

### Problem Definition
Customer dues and supplier payables infinitely inflate. Point-of-sale payments (upfront payments made during a sale or purchase) are completely ignored by the system's balance calculators.

### Root Cause Analysis
- **First Incorrect Calculation:** PostgreSQL View `v_party_balances`.
- **Root Cause:** The `v_party_balances` view calculates outstanding dues by aggregating the `transactions` table based *strictly* on the `transactions.type` column (`sale`, `payment_in`, `purchase`, `payment_out`). It completely ignores the `account_transactions` table. Because an upfront payment made during a sale is recorded as an `account_transactions` row linked to a transaction of type `'sale'`, the view blindly adds the entire sale total to the customer's due and never subtracts the payment.
- **Location:** PostgreSQL (View: `v_party_balances`)
- **Impacts:** Incorrect dues, double counting, phantom money (the system falsely claims customers owe money that has already been collected).

### Dependency Chain
1. **User Action:** Cashier processes a Sale for ৳5,000 and collects ৳5,000 cash upfront.
2. **UI:** Client calls `process_pos_sale` API.
3. **Backend:** Executes PostgreSQL RPC `process_pos_sale`.
4. **Database:** Creates ONE `transactions` row (type=`sale`, total=5000) and ONE `account_transactions` row (amount=5000). *(This mutation is correct)*.
5. **Derived State:** `v_party_balances` sees type=`sale` and blindly adds ৳5,000 to the customer's due. *(Failure Point)*.
6. **Dashboard:** UI reports the customer has an outstanding debt of ৳5,000, despite paying in full.

---

## 2. [P0] Transfer Atomicity Broken (Ledger Corruption Risk)

### Problem Definition
It is architecturally impossible to safely transfer money between two accounts (e.g., Cash to bKash). 

### Root Cause Analysis
- **First Incorrect Mutation:** PostgreSQL RPC `create_transaction_atomic`.
- **Root Cause:** The core RPC used for non-sale financial mutations (`create_transaction_atomic`) only accepts a single `p_account_id` parameter. A true financial transfer requires a double-entry operation: deducting money from a source account and adding it to a destination account simultaneously. Because the RPC only supports one account, the UI/Backend must either fake a transfer using a single-sided transaction (creating phantom money) or execute two separate RPC calls (violating ledger atomicity and risking balance drift if one call fails).
- **Location:** PostgreSQL (RPC: `create_transaction_atomic`), Server Action (`createTransaction`)
- **Impacts:** Balance drift, missing money, phantom money, incorrect reporting.

### Dependency Chain
1. **User Action:** Manager attempts to deposit ৳5,000 from the Cash drawer into the Bank account.
2. **UI:** Submits a transfer request.
3. **Backend:** Calls `createTransaction` with `type=transfer`.
4. **Database:** `create_transaction_atomic` receives only ONE account ID. *(Failure Point)*.
5. **Derived State:** Only one account is debited/credited, or the transaction fails entirely.
6. **Dashboard:** Account balances drift out of sync with reality.

---

## 3. [P1] Daily Profit Calculation Ignores COGS & Income

### Problem Definition
The daily profit calculated during the end-of-day closing is fundamentally inaccurate. It vastly overstates profitability on sales and ignores alternative revenue streams.

### Root Cause Analysis
- **First Incorrect Calculation:** PostgreSQL RPC `get_daily_closing_summary`.
- **Root Cause:** The formula used to calculate daily profit is `v_total_profit := v_total_sales - v_total_expenses;`. This is mathematically incorrect for retail/inventory businesses. It treats gross revenue as net profit because it fails to calculate the Cost of Goods Sold (COGS) by joining `transaction_items` against `products.cost`. Furthermore, it completely ignores `income` transactions, thereby underreporting alternative revenue streams.
- **Location:** PostgreSQL (RPC: `get_daily_closing_summary`), Business Logic.
- **Impacts:** Incorrect profit, incorrect reporting.

### Dependency Chain
1. **User Action:** Cashier completes a shift.
2. **UI:** Requests the daily closing summary.
3. **Backend:** Calls `get_daily_closing_summary`.
4. **Database:** The RPC executes the flawed `v_total_profit` formula. *(Failure Point)*.
5. **Derived State:** A highly inflated/inaccurate profit figure is returned in the JSON object.
6. **Dashboard:** The business owner makes financial decisions based on incorrect profit margins.

---

## 4. [P2] Daily Closing Breakdown Omits Key Transaction Types

### Problem Definition
The end-of-day cash reconciliation breakdown presented to cashiers does not sum mathematically to the expected cash in the drawer.

### Root Cause Analysis
- **First Incorrect Calculation:** PostgreSQL RPC `get_daily_closing_summary`.
- **Root Cause:** The `expected_cash` is calculated correctly by summing all `account_transactions` for cash accounts. However, the variables that provide the human-readable breakdown (`cash_sales`, `cash_expenses`, `cash_received`, `cash_paid`) use hardcoded `WHERE t.type = X` clauses. This logic drops `purchase`, `income`, `transfer`, and `opening_balance` transactions entirely.
- **Location:** PostgreSQL (RPC: `get_daily_closing_summary`)
- **Impacts:** Incorrect closing, reporting/display inconsistency.

### Dependency Chain
1. **User Action:** Cashier begins the Daily Closing flow to count the cash drawer.
2. **UI:** Fetches the daily summary.
3. **Backend:** Calls `get_daily_closing_summary`.
4. **Database:** Sums the breakdown but omits purchases, transfers, and income. *(Failure Point)*.
5. **Derived State:** Returns an `expected_cash` total that does not equal the sum of the breakdown components.
6. **Dashboard:** The cashier is presented with conflicting numbers, causing confusion and inability to successfully reconcile the day's cash.
