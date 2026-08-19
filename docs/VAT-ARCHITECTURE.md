# Bangladesh VAT & Mushak 6.3 Architecture

## Core Principle
VAT and Mushak 6.3 functionality must remain logically separated from the core double-entry transaction engine. The core engine only cares about the final amounts (Total, Subtotal, Adjustments) for financial ledger integrity. VAT is an overlay that translates those totals into compliance-ready documents. Furthermore, VAT features must be **opt-in** at the business settings level to avoid polluting the UX for non-registered micro-merchants.

## 1. Business Configuration (Opt-In)
Businesses that meet the NBR turnover threshold or voluntarily register for VAT will enable it via a setting.
We will introduce a `public.business_tax_profiles` table (1:1 with `businesses`).
- **Fields:**
  - `business_id`: uuid (PK, FK)
  - `vat_enabled`: boolean (default: false)
  - `tin`: string (Tax Identification Number)
  - `bin`: string (Business Identification Number - 13 or 9 digits)
  - `default_vat_rate`: numeric (e.g., 0, 5, 7.5, 15)
  - `default_pricing_model`: enum ('inclusive', 'exclusive')

## 2. Product-Level VAT Configurations
Not all products carry the standard 15% VAT; some have truncated rates or are exempt.
We will extend `public.products` (or use a JSONB `tax_meta` column to avoid schema bloat for non-VAT users):
- **Fields:**
  - `is_taxable`: boolean
  - `hs_code`: string (Harmonized System Code - required for Mushak)
  - `vat_rate`: numeric (overrides business default)

## 3. Customer Tax Information
To issue a proper Mushak 6.3 to B2B clients so they can claim Input Tax Credit (ITC), their tax info is required.
We will extend `public.parties`:
- **Fields:**
  - `tin`: string
  - `bin`: string
  - `is_registered_entity`: boolean

## 4. Transaction / Invoice VAT Overlay
The core `transactions` table tracks the financial movement. We will extend `invoices` to capture Mushak 6.3 specifics.
- **Fields for `invoices`:**
  - `tax_invoice_number`: string (Sequential NBR-compliant number, strictly separate from our internal `invoice_id`)
  - `mushak_reference`: string (e.g., "Mushak-6.3")
  - `pricing_model_applied`: enum ('inclusive', 'exclusive')
  - `total_taxable_value`: numeric
  - `total_vat_amount`: numeric

## 5. Line Item Tax Details
Mushak 6.3 requires tax breakdowns per item.
We will extend `public.invoice_items`:
- **Fields:**
  - `taxable_value`: numeric
  - `vat_rate`: numeric
  - `vat_amount`: numeric

## 6. VAT-Inclusive vs VAT-Exclusive Pricing
The POS and Invoice calculation engine will branch based on the selected pricing model:
- **VAT-Exclusive (Added on top):**
  - `Item Subtotal = Qty * Unit Price`
  - `Item VAT = Item Subtotal * (VAT Rate / 100)`
  - `Item Total = Item Subtotal + Item VAT`
- **VAT-Inclusive (Extracted from total):**
  - `Item Total = Qty * Unit Price`
  - `Item Taxable Value = Item Total / (1 + (VAT Rate / 100))`
  - `Item VAT = Item Total - Item Taxable Value`

## 7. Decoupled Architecture
- **API/RPC Layer:** A specific `generate_mushak_63(invoice_id)` function that reads the finalized transaction and formats it strictly for the NBR template.
- **Reporting:** VAT reports (like Mushak 9.1 data extraction) will be read-only views aggregating `total_vat_amount` and `total_taxable_value` per period, completely separate from P&L or Cash Flow statements.

## 8. Disclaimer
*BizTrack BD provides software tools to assist with calculation and formatting. It does not constitute legal or tax advice. Businesses are solely responsible for verifying their tax obligations and NBR compliance with a certified VAT consultant.*
