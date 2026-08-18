# Export & Print System Audit

## Executive Summary
This document audits the Export (CSV, Excel, PDF) and Print features across the platform. The audit identified severe architectural flaws in how data is exported. The system fails to support the Bengali language in PDFs, fails to handle CSV encodings for Windows, truncates dataset exports, and completely hardcodes the SaaS platform name on tenant receipts.

---

## 1. Export Formats (CSV, Excel, PDF)

The export utilities are located in `src/lib/utils/export.ts` and are primarily used in the Reports module.

| Format | Status | Finding |
| :--- | :--- | :--- |
| **CSV** | 🔴 Broken | Export lacks the UTF-8 Byte Order Mark (BOM) `\uFEFF`. Because of this, Microsoft Excel on Windows defaults to ANSI encoding, resulting in complete Mojibake (corrupted text) for all Bengali text (which is prevalent in this app). |
| **Excel (XLSX)** | 🟡 Partial | Uses `xlsx` library which handles UTF-8 automatically, avoiding the CSV encoding issue. However, the data sent to it is severely truncated. |
| **PDF** | 🔴 Broken | Uses `jsPDF` without registering a custom TTF font. `jsPDF`'s standard font does not support Unicode. Therefore, all Bengali strings (product names, categories, headers) will render as meaningless symbols or squares. |

## 2. Print Receipt (POS)

The receipt printing logic is located in the `print:block` of `src/domains/pos/components/POSClient.tsx`.

| Requirement | Finding | Status |
| :--- | :--- | :--- |
| **Business Name** | Hardcoded to `"BIZTRACK BD"`. If a tenant named "Rahim Store" makes a sale, their receipt says BizTrack BD. | 🔴 Critical |
| **Branch Name** | Not printed anywhere on the receipt. | 🔴 Missing |
| **Date** | Uses `new Date().toLocaleString()`. This relies on the browser's clock, meaning the printed receipt time can maliciously differ from the database's `transaction_date` if the user's PC time is wrong. | 🟡 Warning |
| **Totals** | Accurately reads from the current UI state. | 🟢 Accurate |
| **Language** | Native browser print handles Unicode flawlessly, so Bangla product names will render correctly. | 🟢 Accurate |

## 3. General Export Integrity

### A. Dataset Truncation (No Full Export)
As noted in the Reports Audit, the database RPCs hardcode limits (`LIMIT 20`, `LIMIT 15`). Because the `exportToCSV` function directly consumes the React state from the UI rather than requesting a fresh dataset, **the exported files will silently drop the vast majority of the user's data**. An export of 10,000 transactions will silently export only 20 rows.

### B. Security & Multi-Tenancy
- **Data Leakage:** Because exports are strictly driven by the UI state (which is populated via secure, RLS-enforced `authAction` server actions), the export feature itself is shielded from IDOR. A user cannot export another business's data because the frontend will never receive it.
- **Empty Datasets:** Handled gracefully. `if (!data || !data.length) return` prevents empty files from being generated.

---

## Conclusion
The Export system is unusable for a Bangladeshi SaaS. CSV and PDF exports completely fail to render the Bengali language. Furthermore, the POS receipt generator hardcodes the SaaS parent company's name instead of the actual tenant's business name, breaking white-label/tenant identity expectations.
