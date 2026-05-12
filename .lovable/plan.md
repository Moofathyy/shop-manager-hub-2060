# Delivery & Logistics Module

Admin section for managing carriers, shipping zones/rates, live shipment tracking, and return logistics.

## Pages & Structure

New folder `src/pages/admin/logistics/` with a tabbed container.

- `Logistics.tsx` — tabs container
- `Carriers.tsx` — list, create, edit, toggle, test rate
- `Zones.tsx` — zones list + rates per zone (flat / weight / free) with seller-tier overrides
- `Shipments.tsx` — live dashboard with filters and actions (re-deliver / return)
- `Returns.tsx` — return requests queue with approve/reject, generate label, refund-on-receipt

Route: `/admin/logistics`. Sidebar entry under **Operations** with `Truck` icon.

## Database (one migration)

New enums:
- `shipment_status`: `pending`, `in_transit`, `delivered`, `delayed`, `failed`, `returned`
- `return_status`: `requested`, `approved`, `rejected`, `label_issued`, `in_transit`, `received`, `refunded`
- `rate_type`: `flat`, `weight`, `free`

New tables (all RLS — admins manage; sellers/shoppers see their own where relevant):

- `shipping_carriers` — `name`, `code` (slug), `api_key` (text, masked in UI), `regions` (text[]), `active`, `default_for_regions` (text[])
- `delivery_zones` — `name`, `countries` (text[]), `regions` (text[]), `active`
- `shipping_rates` — `zone_id`, `carrier_id` (nullable), `rate_type`, `flat_amount` (numeric, nullable), `weight_brackets` (jsonb, e.g. `[{maxKg:1, price:5}, ...]`), `seller_tier` (text, nullable for default), `active`
- `shipments` — `order_id`, `carrier_id`, `zone_id`, `tracking_number`, `status` (shipment_status), `estimated_delivery`, `delivered_at`, `failure_reason`, `cost`
- `shipment_events` — `shipment_id`, `status`, `location` (text), `note`, `created_at` (for tracking timeline)
- `return_requests` — `order_id`, `shopper_id`, `seller_id`, `reason`, `status` (return_status), `return_tracking_number`, `label_url`, `refund_amount`, `decided_by`, `decided_at`, `received_at`

Triggers: `tg_set_updated_at` on the tables that have `updated_at`.

Seed data (small but useful):
- 4 carriers (DHL, FedEx, Aramex, Local Courier)
- 4 zones (North America, Europe, Middle East, Asia Pacific)
- 8 rates (mix of flat/weight/free across zones)
- 12 shipments across multiple statuses linked to real `orders.id` if available, else freestanding
- 5 return requests across all statuses

## Frontend details

**Carriers:**
- Table: name, code, regions, active toggle, default-for chips, actions (edit, test rate, delete)
- Create/edit dialog: name, code, API key (password input), regions (comma list), active checkbox
- "Test rate" dialog: pick zone + weight → shows computed rate via the same formula

**Zones & Rates:**
- Two-column layout: left list of zones; right shows rates for selected zone
- Create rate dialog with rate type radio; flat amount or weight brackets editor (add/remove rows); optional seller_tier ("standard" | "premium" | "enterprise")

**Shipments dashboard:**
- KPI cards: in transit, delayed, delivered today, failed
- Filters: status multi-select, carrier select, date range, search by tracking #
- Table with status badges; row click → drawer with timeline (from `shipment_events`), order link
- Actions on failed: "Trigger re-delivery" (status → pending + event), "Return to seller" (status → returned + event)

**Returns:**
- Queue table with filter by status
- Detail drawer: reason, order link, status, return tracking
- Actions: Approve → status `approved`, Generate label → status `label_issued` and fills `return_tracking_number` (mock) + `label_url` (`#`), Mark received → `received` + sets `received_at`, Issue refund → creates a row in `refunds` (status `approved`) and sets return status `refunded`

## Files

**New:**
- `src/pages/admin/logistics/Logistics.tsx`
- `src/pages/admin/logistics/Carriers.tsx`
- `src/pages/admin/logistics/Zones.tsx`
- `src/pages/admin/logistics/Shipments.tsx`
- `src/pages/admin/logistics/Returns.tsx`
- One migration (enums + tables + RLS + seed)

**Edited:**
- `src/App.tsx` — route
- `src/components/AppSidebar.tsx` — sidebar entry

## Out of scope

- Real carrier API integration (rates and tracking are simulated locally using the configured rate rules and stored events)
- Real shipping-label PDF generation (label_url stored as `#` placeholder)
- Customer-facing return request creation (this admin module only manages requests already stored)
- Real-time push updates on the dashboard (manual refresh)
