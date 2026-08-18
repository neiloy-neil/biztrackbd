# Notifications Audit

## Executive Summary
This document outlines the findings of the Notification System audit (`public.platform_notifications`). The system is entirely non-functional. It is a "dead" module where no notifications are ever generated, and its architectural design prevents it from working correctly even if it were wired up. There are no tenant-facing notifications implemented in the codebase.

---

## 1. Dead Notification Types (Never Generated)

The system defines 11 notification types (e.g., `business_created`, `subscription_paid`, `support_ticket`, `security_event`). 

**The Flaw:**
The TypeScript function `createPlatformNotification` in `src/domains/admin/notifications.ts` is the only mechanism provided to create these notifications. **This function is completely unused.** It is never imported or called anywhere in the entire codebase. Furthermore, there are no PostgreSQL triggers designed to automatically generate these notifications upon database events.

**The Impact:**
The notification system is 100% dead. No notifications will ever be delivered to the Super Admin panel. 

---

## 2. Global Shared State (The "Read" Bug)

If notifications were actually generated, they would immediately suffer from a global state bug.

**The Flaw:**
The `platform_notifications` table stores the `is_read` flag as a boolean directly on the notification row itself:
```sql
CREATE TABLE public.platform_notifications (
  ...
  is_read boolean DEFAULT false NOT NULL,
)
```
Rather than using a junction table to track read-state per administrator (e.g., `admin_notification_reads`), the state is shared.

**The Impact:**
If Platform Admin A clicks "Mark as Read", the row is updated in the database. When Platform Admin B logs in, that notification will also appear as "read" and be dismissed from their unread count. If Admin A deletes a notification, it is deleted for all admins globally. Notifications cannot be individually tracked per administrator.

---

## Conclusion
The Platform Notification system must be entirely rebuilt.
1. `is_read` must be removed from the main table, and a new `admin_notification_reads` table must be created to track read state per admin.
2. Database triggers (e.g., `AFTER INSERT ON public.businesses`) or explicit calls to `createPlatformNotification` must be implemented across the codebase to actually generate the notifications.
3. A separate schema for Tenant-level notifications is completely absent and must be designed if intended.
