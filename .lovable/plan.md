
# E-Commerce Admin Dashboard — Full Spec, Phased Build

Your spec covers 14 modules, 5 admin roles, audit logging, fraud detection, logistics, etc. That is a large, multi-week build. To ship something usable fast and avoid a half-broken mega-PR, I'll build it in **4 phases**, each independently shippable. Phase 1 is what gets implemented when you click "Implement plan"; later phases roll out as follow-up prompts.

Backend: Lovable Cloud (Postgres + auth + RLS + edge functions + storage).
Design: Ejada tokens you provided (Readex Pro, primary #001081, radius/elevation rules, etc.).

---

## Phase 1 — Foundation + Core Admin (this implementation)

Everything an admin needs day-one: design system, auth, RBAC, shoppers, sellers, orders, products, basic overview, audit log.

### 1.1 Design system
- `index.css` + `tailwind.config.ts`: all Ejada colors as HSL CSS vars, Readex Pro, spacing scale (4/8/12/16/20/24/32/40/48), radii (card 16, input 12, full 9999), elevation-1 shadow.
- shadcn variants overridden: Button (primary/secondary/ghost/destructive, h-13, radius-full, 16/600), Input (h-13, radius 12, focus border 2px primary), Card (radius 16, p-4, elevation-1), Chip, Badge (status colors using success/warning/destructive/info tokens).
- Load Readex Pro from Google Fonts in `index.html`.

### 1.2 Backend schema (Lovable Cloud)
Tables, all with RLS:
- `profiles` (auth.users FK, full_name, phone, avatar_url, country, status: active/suspended/banned, last_login)
- `user_roles` — separate table; `app_role` enum: `super_admin | finance_admin | support_agent | moderator | marketing_admin | shopper | seller`
- `seller_profiles` (user_id, store_name, business_name, tax_id, kyc_status, approval_status, commission_rate, payout_balance)
- `merchant_applications` (seller_id, documents jsonb, status, decision_reason, decided_by, decided_at)
- `categories` (id, parent_id, name, slug, sort_order)
- `products` (seller_id, title, description, category_id, price, stock, status, sku, images jsonb)
- `orders` (shopper_id, seller_id, status, subtotal, shipping, discount, total, payment_status, shipping_status)
- `order_items` (order_id, product_id, qty, price)
- `audit_log` (admin_id, action, entity_type, entity_id, metadata, ip, created_at)
- `storage` bucket: `merchant-docs` (private), `product-images` (public)

Security:
- `has_role(uid, role)` SECURITY DEFINER
- `is_admin(uid)` returns true for any of the 5 admin roles
- Admin RLS policies use `is_admin(auth.uid())`
- `on_auth_user_created` trigger creates profile

### 1.3 Auth + RBAC
- `/auth` login (email + password, Ejada-styled)
- `<AdminRoute requiredRole="...">` wrapper guards every `/admin/*` route
- Role-aware sidebar (hide modules user can't access)
- Logout, current admin badge in top bar

### 1.4 App shell
- Collapsible left sidebar (shadcn Sidebar) with module groups
- Top bar (h-14): global search input (wired to a stub, fully functional in Phase 2), notifications bell, admin avatar/menu
- Breadcrumbs on inner pages
- Toaster + confirmation modals + skeleton loaders (no spinners)

### 1.5 Modules in Phase 1
- **Overview** — KPI cards (GMV today/week/month, active shoppers, active sellers, pending merchants, pending products), Revenue line chart, Orders bar chart, Shoppers vs Sellers signups (recharts).
- **Shoppers** — list (search, filter by status/date/country/order count, sort, CSV export, pagination 25/50/100). Profile page: account info, order history, addresses, suspend/ban/warn/reset password (all logged to audit_log).
- **Sellers** — list with filters; profile page: business info, KYC, products breakdown, revenue, commission override, performance score, reviews, suspend/ban.
- **Merchant approval queue** — pending applications, doc viewer, Approve / Reject (reason) / Request more info, audit trail.
- **Products** — catalog list + filters; product approval queue (bulk approve/reject); product detail edit (override title/desc/category/SEO, unpublish).
- **Categories** — CRUD with nested hierarchy + drag-and-drop reorder.
- **Orders** — list with all filters; detail page (items, shopper/seller links, payment, shipping, timeline), cancel order, mark resolved, flag.
- **Audit log** — read-only viewer with filters and CSV export.

### 1.6 Cross-cutting
- Server-side pagination on all large lists
- Status badges semantically tokenized
- Confirmation modal for every destructive action
- Toast on every mutation
- Empty states with CTAs
- All admin mutations write to `audit_log` via a shared helper

---

## Phase 2 — Finance, Reviews, Support

- **Payments & Finance**: transactions table, payouts (schedule, queue, manual trigger, hold), refund management, basic fraud flags, financial reports.
- **Reviews & Trust**: review list + moderation, dispute resolution UI, trust scores.
- **Support & Tickets**: ticket list, detail with thread, assignment, SLA timers, canned replies, internal notes.
- New tables: `transactions`, `payouts`, `refunds`, `reviews`, `disputes`, `tickets`, `ticket_messages`.

---

## Phase 3 — Marketing, Logistics, Advanced Analytics

- **Marketing**: coupons, flash sales, banners, push/email notifications, featured slots, referral, loyalty.
- **Delivery & Logistics**: shipping providers config, zones & rates, shipment tracking, return logistics.
- **Advanced Analytics**: cohort retention, conversion funnel, geographic map, custom reports with scheduling.
- New tables: `coupons`, `banners`, `notifications`, `loyalty_points`, `shipping_zones`, `shipments`, `returns`.

---

## Phase 4 — Security, Compliance, Settings

- 2FA enforcement per admin, active session management, password policy.
- Security alerts dashboard.
- Platform settings: payment gateway config, commission rates, feature flags, email templates, maintenance mode.
- Notifications system (in-app bell with unread count + email fallback edge function).

---

## Out of scope (across all phases unless requested)

- Building the shopper/seller-facing storefront — schema is designed so it plugs in later.
- Real payment processing (Stripe) — refund/payout records are tracked; money movement requires a separate Stripe integration step.
- Identity verification provider integration (KYC docs are stored & reviewed manually until a provider is wired up).
- Carrier API integrations (mocked in Phase 3 unless you provide credentials).

---

## Decision points before I start Phase 1

I'll proceed with these defaults unless you say otherwise:
1. Languages/RTL: English LTR only for now (Readex Pro supports Arabic — say the word for RTL).
2. First admin: I'll show you the SQL snippet to promote your account to `super_admin` after signup.
3. Demo seed data: I'll include a small seed script (5 shoppers, 3 sellers, 10 products, 8 orders) so the dashboard isn't empty.

If any of those need to change, tell me before clicking Implement; otherwise I'll ship Phase 1 as scoped above.
