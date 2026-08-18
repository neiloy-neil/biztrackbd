# Mobile-First Functional Audit

## Executive Summary
This document outlines the visual and functional layout issues across the BizTrack SaaS application. The audit specifically focuses on Android devices at standard mobile viewports (320px, 375px, 390px, 412px). The application exhibits several severe usability issues regarding touch targets, virtual keyboards, and modal overflow.

---

## 1. Virtual Keyboard vs. Fixed Bottom Navigation
**Location:** `src/components/layout/MobileNav.tsx`
**Issue:** The main mobile navigation uses a simple `fixed bottom-0` CSS class. On Android devices, when the virtual keyboard is opened (e.g., to type a search query or enter a price), the browser resizes the viewport. This pushes the fixed bottom navigation *up*, causing it to float directly on top of the keyboard. This obscures the input fields and any search results beneath it, making forms extremely difficult to fill out.
**Viewport Impact:** All Mobile (320px - 412px)

## 2. Modal Overflow (Inaccessible Buttons)
**Location:** POS Checkout Dialog (`src/domains/pos/components/POSClient.tsx`)
**Issue:** The `<DialogContent>` for the checkout flow lacks a `max-h-[80vh]` and `overflow-y-auto` constraint. The checkout modal contains several inputs (Customer, Account, Payment Amount, Discount). On smaller screens (320px / 375px), especially when the Android keyboard is open, the modal stretches beyond the screen bounds. Because it does not scroll internally, the final "Pay" button becomes completely inaccessible, completely blocking the checkout flow.
**Viewport Impact:** 320px, 375px

## 3. Tiny Touch Targets (Fat-Finger Errors)
**Location:** POS Cart Items (`src/domains/pos/components/POSClient.tsx`)
**Issue:** The increment (+), decrement (-), edit, and delete buttons inside the mobile cart use `w-8 h-8` (32px x 32px) dimensions. The mobile UX standard for touch targets is a minimum of 44px (ideally 48px). At 32px, users will frequently misclick and delete items from their cart when trying to increment the quantity, or vice-versa.
**Viewport Impact:** All Mobile

## 4. Horizontal Table Overflow
**Location:** Inventory & Reports (`src/app/app/inventory/page.tsx`)
**Issue:** Data is presented using standard HTML `<table>` elements wrapped in an `overflow-x-auto` container. While this prevents the entire page layout from breaking, forcing horizontal scrolling on a primary mobile view is a highly degraded UX. On a 320px screen, users can only see the product name and must scroll horizontally to see the price, stock, or action buttons. (Best practice is to collapse tables into vertical cards on mobile).
**Viewport Impact:** 320px, 375px

## 5. Text Truncation in Grids
**Location:** POS Product Grid
**Issue:** The POS screen utilizes a `grid-cols-2` layout on mobile. On ultra-narrow screens (320px), the width of each product card is extremely constrained. Because the UI uses `line-clamp-2`, product names with more than 3-4 words are heavily truncated, making it difficult for cashiers to distinguish between similar items (e.g., "Pran Mango Juice 250ml" vs "Pran Mango Juice 500ml").
**Viewport Impact:** 320px

---

## Conclusion
The application was built with a "desktop-first" mentality using Tailwind's responsive prefixes to hide/show sidebars. It requires a dedicated mobile-first pass to handle virtual keyboards, increase touch targets to 48px, constrain tall modals with internal scrolling, and convert horizontal tables into vertical cards.
