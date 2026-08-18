# Settings Audit

## Executive Summary
This document outlines the findings of the Settings module audit. The vast majority of standard SaaS application settings are entirely unimplemented. Several settings exist as columns in the database but have no corresponding User Interface or Server Actions to modify them.

---

## 1. Unimplemented Settings (Missing UI & Logic)

The following settings were requested for audit but are **completely missing** from the application. There is no UI to view them, no Server Actions to update them, and in some cases, no database schema to support them.

- **Business Profile:** There is no UI to update the Business Name, Logo, Currency, Timezone, or Language. Currency (`BDT`) and Timezone (`Asia/Dhaka`) are hardcoded in the UI components (e.g., `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'BDT' })`).
- **Branch Management:** The `branches` table exists in the database, and a default branch is created during signup. However, there is no UI to add, edit, or delete branches.
- **Invoice & Receipt Settings:** The `public.settings` table contains `receipt_header` and `receipt_footer` columns. However, there is no UI for tenants to modify these values.
- **Tax Settings:** Completely un-implemented. No database schema or UI exists for managing tax rates.
- **Notification Preferences:** There is no UI for tenants to manage email or push notification preferences.
- **Custom Roles & Permissions:** The system uses hardcoded enums (`owner`, `manager`, `cashier`). There is no UI for creating custom roles or tweaking granular permissions.

---

## 2. Implemented Settings

The following settings are implemented and functional:

### A. User Profile (`/app/settings/profile`)
- **Functional:** Users can update their `full_name`.
- **Limitation:** The user's `phone` number is strictly read-only and cannot be changed from the profile page.

### B. Staff Management (`/app/settings/staff`)
- **Functional:** Users with the `staff.manage` permission can Add Staff (via phone number), Update Staff Roles, and Remove Staff.
- **Security:** Validates against the SaaS entitlement engine (`staff_limit`) before allowing a new staff member to be added.
- **Persistence:** Changes correctly persist to the `business_members` table.

### C. Billing Settings (`/app/settings/billing`)
- **Functional:** Users can view their current plan, browse available plans, and view past invoices. (Note: The actual payment pipeline has critical flaws documented in the `BILLING-AUDIT.md`, but the settings UI itself correctly reads from the database).

---

## 3. Dead UI Controls

- **SMS Rate Button:** On the main settings dashboard (`/app/settings`), there is a button labeled **"এসএমএস রেট (SMS Rate)"**. This is a dead button with no `href`, `onClick` handler, or corresponding functionality.

## Conclusion
The Settings module requires significant expansion to reach feature parity with a standard SaaS application. The priority should be building a Business Profile settings page to allow tenants to configure their Business Name, Currency, Timezone, and Receipt Headers, followed by a Branch Management UI.
