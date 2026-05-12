# Analytics & Reports Module

Centralized platform performance insights with KPIs, charts, cohort analysis, geo breakdown, and a custom report builder.

## Pages & Structure

New section under `src/pages/admin/analytics/` with a tabbed container:

- `Analytics.tsx` — tabs container (Dashboard / Custom Reports)
- `Dashboard.tsx` — KPI cards + all charts on one scrollable page
- `CustomReports.tsx` — date-range + metric/dimension builder with table preview and CSV export

Route: `/admin/analytics`. Sidebar entry under **Operations** with `BarChart3` icon.

## Dashboard contents

**KPI cards (top row, 5 across):**
- GMV (sum of `orders.total`)
- Net revenue (GMV − refunds)
- AOV (GMV ÷ order count)
- Shoppers (total / new this month / returning)
- Sellers (total / new / active in last 30d)
- Conversion rate, cart abandonment — shown as static demo values (no visits/sessions table exists yet)

Each card shows current value and % delta vs previous period.

**Charts:**
- Revenue over time — line (recharts), toggle Daily / Weekly / Monthly via tabs
- Orders over time — bar chart with same granularity toggle
- Top 10 products by revenue — horizontal bar list
- Top 10 sellers by revenue — horizontal bar list
- Top categories by sales — donut/pie
- Geographic sales — country breakdown (table + bars from `profiles.country` joined to orders via `shopper_id`); no real map library — country bar list keeps bundle small
- Cohort retention — matrix table: rows = registration month, cols = months since signup, cells = % retained (computed from `profiles.created_at` + their order activity months)
- Funnel — vertical 5-stage funnel (visits → product views → add to cart → checkout → purchase); since we have no event tracking, derive checkout/purchase from `orders` and use illustrative ratios for the upper stages

## Custom report builder

Form:
- Date range picker (shadcn calendar, two popovers)
- Metrics multi-select: GMV, orders, AOV, refund amount, refund count, new shoppers, new sellers
- Dimension (group by): seller / category / country / product / day
- "Run report" button → renders results in a `Table`
- "Export CSV" downloads as `report-YYYY-MM-DD.csv`
- "Schedule" dialog: frequency (daily/weekly/monthly) + recipient email → inserts into a new `scheduled_reports` table (no actual email send — just stored; surfaced under "Scheduled reports" list with delete)

Excel/PDF export are **out of scope** for v1 (CSV only). Real email delivery of scheduled reports is also out of scope — records are stored.

## Database

One migration:
- `scheduled_reports` table: `name`, `config jsonb` (metrics, dimension, date range pattern), `frequency` (`daily|weekly|monthly`), `recipient_email`, `last_run_at`, `next_run_at`, `created_by`, `active`
- RLS: admins manage all (`is_admin(auth.uid())`)

No seeding needed; data is computed from existing `orders`, `order_items`, `products`, `profiles`, `seller_profiles`, `categories`, `refunds`.

## Files

**New:**
- `src/pages/admin/analytics/Analytics.tsx`
- `src/pages/admin/analytics/Dashboard.tsx`
- `src/pages/admin/analytics/CustomReports.tsx`
- `src/lib/analytics.ts` — query helpers (KPIs, time series, top lists, cohort, funnel)
- `src/lib/csvExport.ts` — small CSV stringifier
- One migration for `scheduled_reports`

**Edited:**
- `src/App.tsx` — route
- `src/components/AppSidebar.tsx` — sidebar entry

## Dependencies

`recharts` is already in the project (used elsewhere). `date-fns` is already in use. No new dependencies.

## Out of scope

- Real session/page-view tracking (no events table) — conversion/abandonment/funnel upper stages use illustrative values clearly labeled "estimated"
- Actual world map visualization — using a country bar list
- Excel and PDF export — CSV only
- Real email delivery of scheduled reports — only stored
