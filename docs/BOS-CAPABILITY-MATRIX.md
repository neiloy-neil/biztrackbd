# BizTrack BD: Business Operating System Capability Matrix

This document provides a holistic capability matrix evaluating whether the currently implemented BizTrack BD product can reliably support a complete business lifecycle end-to-end.

## Overall Assessment
While BizTrack BD has an incredibly robust **Financial Control**, **Inventory**, and **SaaS** backend, it **cannot** currently support a reliable, full business lifecycle due to critical gaps in **Daily Operations (POS)** and **Business Setup (Staff/Branches)**. 

---

## 1. BUSINESS SETUP
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Business profile** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Fully functional onboarding. |
| **Branch** | Yes | Yes | Yes | Yes | **No** | Yes | Yes | **No** | RLS fails to scope inventory/transactions to `branch_id`. |
| **Staff** | Yes | Yes | Yes | Yes | Yes | **No** | No | **No** | FE sends incorrect string for `user_roles` enum, failing inserts. |
| **Accounts** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Account materialization handles this perfectly. |

---

## 2. DAILY OPERATIONS
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Sales (POS)** | Partial | Yes | **No** | **No** | N/A | N/A | No | **No** | Cart UI exists, but no RPC translates cart to transactions/inventory. |
| **Income** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Standard transactions flow. |
| **Expenses** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Standard transactions flow. |
| **Customer Pymts** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Supported via party ledgers. |
| **Supplier Pymts** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Supported via party ledgers. |
| **Inventory** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Reversal engine handles stock natively. |
| **Transfers** | Partial | **No** | Yes | Yes | Yes | Yes | No | **No** | DB supports account transfers, but UI form is missing. |

---

## 3. FINANCIAL CONTROL
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Cash/bKash/Bank** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Mapped correctly in Accounts UI. |
| **Money Visibility** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Top-level visibility widget exists. |
| **Daily Closing** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Fully functional and validated. |
| **Reconciliation** | No | **No** | **No** | **No** | N/A | N/A | No | **No** | No dedicated reconciliation flow exists. |

---

## 4. RELATIONSHIPS
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Customers** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Defined in `parties`. |
| **Suppliers** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Defined in `parties`. |
| **Due** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Calculated correctly via RPC. |
| **Statements** | Partial | **No** | Yes | Yes | Yes | Yes | No | **No** | DB handles ledger, but no statement export UI exists. |

---

## 5. INVENTORY
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Products** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Fully functional. |
| **Purchases** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Treated as inbound inventory transactions. |
| **Sales** | Partial | **No** | Yes | Yes | Yes | Yes | No | **No** | Blocked by the incomplete POS backend. |
| **Adjustments** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Reversal engine handles discrepancies. |
| **Reversals** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | SQL engine ensures atomicity. |
| **Low stock** | Partial | **No** | Yes | Yes | Yes | Yes | No | **No** | Smart Alerts generate for low stock, but no UI consumes them. |

---

## 6. ANALYTICS
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Dashboard** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Functional but suffers from aggressive caching. |
| **Profit** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Calculated accurately. |
| **Cashflow** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Sourced directly from transactions. |
| **Business Health** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Health score calculation is solid. |
| **Insights** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | AI/SQL insights generate correctly. |
| **Alerts** | Partial | **No** | Yes | Yes | Yes | Yes | No | **No** | Alerts exist in DB, missing UI footprint. |

---

## 7. SAAS
| Workflow | Implemented? | FE Connected? | BE Connected? | DB Connected? | RLS Correct? | RBAC Correct? | Output Reflected? | Works End-to-End? | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Plan** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Admin and user side fully functional. |
| **Subscription** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Accurate lifecycle management. |
| **Billing** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Integration with UddoktaPay is heavily secured. |
| **Invoice** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Generated correctly, UI history available. |
| **Usage** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Accurately tracks business quotas. |
| **Entitlements** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Gated middleware enforces limits. |

## Conclusion
BizTrack BD **cannot yet reliably support** a complete business lifecycle. The primary blocker is the **Point of Sale (Sales)** workflow. Since the POS UI is entirely detached from the backend, a business cannot easily process outgoing retail sales, making the system incomplete as a Business Operating System. Fixing the POS backend, Branch RLS, and Staff RBAC is mandatory before going to market.
