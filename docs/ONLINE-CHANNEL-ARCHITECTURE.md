# BizTrack BD: Online Channel Architecture

## Core Philosophy
The Online Store is **not** a separate eCommerce platform. It is simply an additional "Branch" or "Channel" overlay sitting on top of the exact same BizTrack core engine.
- **Same Products:** An item available online is just a `product` marked as `is_published_online = true`.
- **Same Inventory:** Stock is deducted from the canonical `inventory_movements` table.
- **Same Financials:** An online order creates the exact same `transactions` and `account_transactions` as a POS sale, ensuring double-entry accounting remains intact.

## 1. Storefront & Catalog
To expose products to the public without risking the core internal API, we will use a specialized public API route or a read-only materialized view.
- **`public.storefront_profiles`**: Tracks the business's online slug (e.g., `shop.biztrack.com/my-shop`), logo, banner, and theme colors.
- **Products**: Add `is_published_online` (boolean) to `public.products`.
- **Variants**: Existing `product_variants` will be exposed so customers can select sizes/colors.

## 2. Order Lifecycle (The Checkout Flow)
An "Order" is simply a transaction in a pending state with shipping metadata.

### Step A: Order Placement
1. Customer visits the public storefront and adds items to the cart.
2. Checkout requires Phone Number and Name.
3. System checks `parties` table for the phone number. If it exists, link to the existing Customer. If not, create a new Customer party.
4. System creates a `transaction` with:
   - `type` = 'online_order'
   - `state` = 'pending'
5. System creates `transaction_items` for the cart contents.

### Step B: Payment & COD
- **Online Payment (e.g., BKash/UddoktaPay):** If paid immediately, an `account_transaction` is created against the "Online Gateway" account, and the order `state` becomes 'processing'.
- **Cash on Delivery (COD):** No `account_transaction` is created yet. The order `state` becomes 'processing'. A receivable (Current Due) is conceptually logged against the courier or the customer.

### Step C: Fulfillment & Shipping
- **`public.shipments`** (New Table):
  - `transaction_id` (FK)
  - `courier_name` (e.g., Pathao, RedX, Steadfast)
  - `tracking_number`
  - `shipping_cost`
  - `status` ('pending', 'shipped', 'delivered', 'returned')
- **Inventory Sync:** When the order transitions to 'shipped', `inventory_movements` (type 'out') are recorded. Stock is officially deducted.

### Step D: Final Accounting
- **If Delivered (COD):** The Courier remits the money. An `account_transaction` is recorded from the "Courier Receivable" into the "Bank/Cash" account.
- **Profit Calculation:** Since the `transaction_items` mirror the POS system, `unit_price` and `cost` are known. Order Profit is calculated exactly like a POS sale, minus the `shipping_cost`.

## 3. Returns & Refunds
If an order is returned (e.g., customer rejected delivery):
1. The `shipment.status` changes to 'returned'.
2. The `transaction` is reversed using our existing `reverse_inventory_transaction` engine.
3. `inventory_movements` (type 'in') restore the stock.
4. Any partial payments are logged as Refunds (`account_transactions` type 'expense'/'refund').

## 4. Entity Mapping (The Unified Engine)

| eCommerce Concept | BizTrack Canonical Entity |
| :--- | :--- |
| Shopping Cart Checkout | `process_pos_sale` (modified for 'pending' state) |
| Order Line Items | `transaction_items` |
| Customer Account | `parties` (Type: Customer) |
| Payment Success | `account_transactions` |
| Order Delivered | `inventory_movements` (Out) |
| Order Returned | `inventory_movements` (In) |
| Delivery Charge | New item type or separate fee column in `transactions` |

## 5. Security boundaries
- The public storefront must use a restricted **Anon Key** with strictly enforced Row Level Security (RLS) that only allows `SELECT` on products where `is_published_online = true`.
- Checkout mutations must go through a secure RPC (e.g., `submit_online_order`) that acts as a Security Definer, bypassing RLS just long enough to insert the pending order and link the customer, preventing malicious data scraping or injection.
