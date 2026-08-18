# Performance & Scalability Audit

## Executive Summary
This document outlines the performance characteristics of the BizTrack platform when subjected to realistic SaaS data volumes (e.g., 100,000 transactions, 10,000 products, 5,000 customers). The current architecture suffers from critical missing indexes, `COUNT(*)` full table scans, and unoptimized RLS functions that will cause catastrophic database CPU spikes and timeout errors under moderate load.

---

## 1. Missing Database Indexes (Full Table Scans)
**Issue:** The core schema (`20260816020000_ddd_schema.sql`) completely omits `CREATE INDEX` statements for foreign keys.
**Simulation (100,000 transactions across 50 businesses):**
- When querying `SELECT * FROM transactions WHERE business_id = 'XYZ'`, PostgreSQL must perform a Sequential Scan (full table scan) across all 100,000 rows because `business_id` is not indexed.
- **Impact:** High latency for all basic data retrieval, leading to rapid connection pool exhaustion.

## 2. Dashboard Exact Count (O(N) Degradation)
**Location:** `src/app/app/dashboard/page.tsx`
**Issue:** To determine if a user should see the `DashboardEmptyState`, the server component runs:
```typescript
.from('transactions').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
```
**Simulation (100,000 transactions):**
- PostgreSQL MVCC requires actually traversing all 100,000 rows to ensure they are visible to the current transaction just to return the number `100,000`.
- **Impact:** The Dashboard load time will increase linearly as the business grows, eventually timing out. It should use an `EXISTS` check (`.limit(1)`) instead of an exact count.

## 3. RLS Policy Nested Loop Overhead
**Location:** `public.is_business_member(uuid)`
**Issue:** The RLS function executes a query against `businesses` to check `owner_id = auth.uid()`.
**Simulation (100,000 transactions):**
- Because RLS applies row-by-row during a sequential scan (due to the missing `business_id` index), this function is invoked thousands of times. Furthermore, `owner_id` on the `businesses` table lacks an index.
- **Impact:** Database CPU will spike to 100% due to nested loop joins on unindexed columns during large table reads.

## 4. Lack of Data Pagination
**Location:** Transaction and Inventory Actions (`src/domains/transactions/actions.ts`)
**Issue:** Queries are hardcoded with `.limit(50)` without accepting `page` or `offset` parameters.
**Simulation (1,000 transactions):**
- The user can only ever see the last 50 transactions. There is no mechanism (cursor or offset) to view historical data. The frontend UI does not implement infinite scrolling or pagination controls.
- **Impact:** Severe functional limitation; users lose access to their own historical data after 50 entries.

## 5. Zero Client-Side Caching (Unnecessary DB Load)
**Location:** Global Architecture
**Issue:** `@tanstack/react-query` is installed in `package.json` but is completely unused. The application relies entirely on Next.js Server Components fetching directly from Supabase on every route transition.
**Simulation (Multiple Staff):**
- If 5 cashiers are switching between the POS, Inventory, and Dashboard tabs, the database is hit with identical queries hundreds of times per minute.
- **Impact:** Unnecessary database egress costs and slower UI transitions.

## 6. Aggregate Query Slams
**Location:** `DashboardClient` / `DashboardMetrics`
**Issue:** The Dashboard UI renders multiple separate Server Components (`DashboardMetrics`, `MoneyVisibility`, `DashboardTrend`) which individually query the database to aggregate sums (e.g., `SUM(total_amount)`).
**Simulation (100,000 transactions):**
- The database must scan the transactions table 3-4 separate times concurrently per page load because the aggregates are not pre-calculated or materialized.
- **Impact:** Dashboard loading will become painfully slow for mature businesses.

---

## Recommendations (Do Not Implement Yet)
1. Generate a massive `CREATE INDEX` migration for all `business_id`, `branch_id`, and `category_id` foreign keys.
2. Replace `count: 'exact'` with `.limit(1)` for existence checks.
3. Rewrite RLS functions to use JWT claims (`auth.jwt() -> 'user_metadata'`) to avoid table joins entirely.
4. Implement cursor-based pagination for transactions.
5. Implement Materialized Views for Dashboard aggregates, refreshed asynchronously.
