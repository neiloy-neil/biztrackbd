# Competitive Gap Roadmap: BizTrack BD vs Local Competitors

This document evaluates BizTrack BD against current Bangladesh market players (TallyKhata, Hishabee, AndgateBOS, Hisab Khata, Cash Khata, Store Desk, Dokani POS, Baki.bd).

## Evaluation Classifications
- **TABLE STAKES**: Essential features required just to compete. Absence means losing customers immediately.
- **COMPETITIVE ADVANTAGE**: Features that differentiate us and drive adoption, though competitors might have basic versions.
- **MARKET DIFFERENTIATOR**: Unique, high-value capabilities that competitors entirely lack or do poorly.
- **LOW VALUE**: Features competitors have that don't actually drive significant retention or revenue for SME merchants.
- **NOT WORTH BUILDING**: Feature bloat or misaligned functionality that actively harms the core product experience.

---

## 1. Core Financial & Ledger (Khata)

| Feature | Competitor Landscape | BizTrack Status | Classification | Priority | Value / Effort |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Khata (Due/Baki Tracking)** | Core to TallyKhata, Baki.bd. | **Fully Implemented** | TABLE STAKES | P0 | High / Low |
| **Sales & Purchases** | Universal | **Fully Implemented** | TABLE STAKES | P0 | High / Low |
| **Bank Reconciliation** | Missing in most basic khata apps, present in AndgateBOS. | **Implemented** (Daily Closing) | COMPETITIVE ADVANTAGE | P1 | High / Med |

## 2. Inventory & POS

| Feature | Competitor Landscape | BizTrack Status | Classification | Priority | Value / Effort |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POS Interface** | Hishabee, Store Desk, Dokani excel here. | **Fully Implemented** | TABLE STAKES | P0 | High / Low |
| **Simple Inventory** | Universal. | **Fully Implemented** | TABLE STAKES | P0 | High / Low |
| **Returns Engine** | Weak in most basic apps. | **Fully Implemented** | COMPETITIVE ADVANTAGE | P1 | High / High |
| **Variants (Size/Color)** | Missing in basic apps; present in Store Desk. | *Architected, Pending UI* | COMPETITIVE ADVANTAGE | P1 | Med / Med |
| **Expiry & Batch** | Rare (Pharma-specific POS usually required). | *Architected, Pending UI* | MARKET DIFFERENTIATOR | P2 | Med / Med |
| **Warranty / IMEI** | Rare (Electronics-specific POS usually required). | *Architected, Pending UI* | MARKET DIFFERENTIATOR | P2 | Med / Med |

## 3. Advanced Operations & Compliance

| Feature | Competitor Landscape | BizTrack Status | Classification | Priority | Value / Effort |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Multi-branch** | AndgateBOS, Store Desk. | **Fully Implemented** | COMPETITIVE ADVANTAGE | P1 | High / High |
| **Staff Roles (RBAC)** | Present in mature POS, absent in simple Khata. | **Fully Implemented** | TABLE STAKES | P0 | High / Med |
| **Payroll** | Sometimes bolted on by ERP-lites. | *Not Implemented* | LOW VALUE | P4 | Low / High |
| **VAT & Mushak 6.3** | Absent in most SME apps; enterprise only. | *Architected, Pending UI* | MARKET DIFFERENTIATOR | P2 | Med / High |

## 4. Digital Extensions & AI

| Feature | Competitor Landscape | BizTrack Status | Classification | Priority | Value / Effort |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Online Store** | Hishabee pushes this heavily. | *Architected, Pending* | COMPETITIVE ADVANTAGE | P2 | High / High |
| **Courier / Shipping** | Steadfast/Pathao integrations are highly requested. | *Pending* | COMPETITIVE ADVANTAGE | P2 | High / Med |
| **COD Management** | Crucial for BD e-commerce. | *Architected* | MARKET DIFFERENTIATOR | P2 | High / Med |
| **Digital Payments (bKash/Nagad)** | Hishabee/TallyKhata offer wallet integrations. | *Pending Merchant API* | COMPETITIVE ADVANTAGE | P1 | High / High |
| **Business Intelligence** | Basic charts are common. Deep insights are rare. | **Partially Implemented** | MARKET DIFFERENTIATOR | P2 | High / Med |
| **Offline First** | TallyKhata dominates here. | **Fully Implemented** | MARKET DIFFERENTIATOR | P0 | High / High |
| **Voice / AI Entry** | Non-existent in local competitors. | *Not Implemented* | MARKET DIFFERENTIATOR | P3 | Med / High |
| **SME Financing / Loans** | TallyKhata's endgame (TallyPay). | *Not Implemented* | NOT WORTH BUILDING | P5 | High (Risk) / High |

---

## Strategic Roadmap & Analysis

### 1. Defend the Core (Table Stakes)
BizTrack has successfully achieved parity with the core capabilities of TallyKhata and Dokani POS. The offline-first architecture combined with the robust Khata (Due) system and POS ensures that no merchant will churn due to missing basic features. 

### 2. Capitalize on the Gap (Competitive Advantage)
Local competitors suffer from a sharp divide: they are either too simple (TallyKhata) or too complex and bloated (traditional ERPs). BizTrack's primary competitive advantage is offering **Enterprise-grade features (Multi-branch, Returns, Daily Closing Reconciliation) with Consumer-grade UX**. 
* **Next Immediate Action:** Finish the UI for the newly architected Inventory Extensions (Variants) to capture fashion and electronics retailers transitioning away from Hishabee.

### 3. Build Moats (Market Differentiators)
- **VAT / Mushak:** As the NBR tightens tax nets, mid-sized SMEs will be forced to comply. Delivering automated Mushak 6.3 compliance without the bloat of TallyPrime or local legacy software will establish a massive moat.
- **Unified Online Channel:** Hishabee attempts this, but their core financial ledger is weak. By rolling out the Online Store architecture, BizTrack will offer a flawless O2O (Online-to-Offline) sync that actively prevents overselling and perfectly maps COD payments back to the core ledger.

### 4. What to Ignore (Low Value / Not Worth Building)
- **Payroll & HR:** Do not build this. Small businesses in BD manage salaries informally. Building a formal payroll module is extremely high effort for near-zero retention impact.
- **Direct SME Financing:** While lucrative for VC-backed players like TallyKhata, becoming a lender carries massive regulatory and credit risk. BizTrack should remain a SaaS platform, potentially offering an API for banks to access merchant data (with consent) rather than issuing loans directly.
