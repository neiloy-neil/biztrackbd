# Permission & Role Audit

## Overview
BizTrack BD implements RBAC utilizing four distinct roles: **Owner**, **Manager**, **Cashier**, and **Staff**. 

The system distributes authorization logic across three layers:
1. **UI Layer** (Client-side components)
2. **Backend/Server Actions** (`authAction`, `requirePermission`)
3. **Database RLS Policies** (`is_business_member`, `has_permission`)

While the UI and RLS generally perform as expected, significant vulnerabilities exist at the Backend Server Action layer, where explicit permission checks are missing.

---

## Role / Permission Matrix

| Feature | Owner | Manager | Cashier | Staff | UI Blocked? | Backend Enforced? | RLS Enforced? | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Sales (Create)** | ✓ | ✓ | ✓ | - | Yes | Yes | Yes | **SECURE** |
| **Expenses (Create)** | ✓ | ✓ | - | - | Yes | Yes | Yes | **SECURE** |
| **Products (Create)** | ✓ | ✓ | - | - | Yes | **NO** | Yes | **PARTIAL** |
| **Inventory (Manage)** | ✓ | ✓ | - | - | Yes | **NO** | **NO** | **VULNERABLE** |
| **Customers (Manage)** | ✓ | ✓ | - | - | Yes | **NO** | Yes | **PARTIAL** |
| **Suppliers (Manage)** | ✓ | ✓ | - | - | Yes | **NO** | Yes | **PARTIAL** |
| **Daily Closing** | ✓ | ✓ | ✓ | - | Yes | Yes | Yes | **SECURE** |
| **Staff (Manage)** | ✓ | ✓ | - | - | Yes | Yes | N/A | **SECURE** |
| **Billing (Manage)** | ✓ | - | - | - | Yes | **NO** | N/A | **VULNERABLE** |

---

## Critical Authorization Failures (API Bypasses)

### 1. Inventory Management Bypass
**Vulnerability:** Cashiers and Staff can manually invoke the `recordMovement` server action to modify stock levels, bypassing the UI restrictions.
**Mechanism:** 
- The `inventory/actions.ts -> recordMovement` action wraps execution in `authAction`, verifying the user is in the business, but **fails to check** `inventory.manage` via `hasPermission()` or `requirePermission()`.
- The `inventory_movements` table RLS policy allows `INSERT` for *any* business member.
**Impact:** Unprivileged staff can arbitrarily manipulate inventory numbers.

### 2. Billing & Subscription Escalation
**Vulnerability:** Any staff member (including cashiers or base staff) can alter the business's SaaS subscription.
**Mechanism:**
- The `billing/actions.ts -> startCheckoutAction` and `changePlanAction` do not utilize `authAction` or `requirePermission`.
- They manually query `business_members` simply to fetch the `business_id`, ignoring the user's `role`.
**Impact:** A disgruntled staff member could upgrade the business to the highest tier plan or cancel the active subscription.

### 3. Missing Action-Level Constraints (Defense in Depth)
**Vulnerability:** Server Actions like `createProduct` and `createParty` completely omit `hasPermission()` checks.
**Mechanism:**
- The system relies *exclusively* on the PostgreSQL RLS policy (`RBAC INSERT products`, `RBAC INSERT parties`) to block unauthorized creation.
- While the RLS policy correctly throws an exception and prevents the write, the Server Action layer executes unnecessary logic and relies on database exceptions for business-logic enforcement, violating the defense-in-depth principle.

## Recommended Fixes
1. Wrap `recordMovement` with `requirePermission('inventory.manage', authAction(...))`.
2. Wrap all billing mutations with `requirePermission('settings.manage', ...)` or restrict strictly to `'owner'`.
3. Add `hasPermission` checks to `createProduct` and `createParty` at the Next.js Server Action boundary.
4. Add an explicit `RBAC INSERT inventory_movements` policy to PostgreSQL matching `inventory.manage`.
