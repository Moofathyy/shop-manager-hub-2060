# Marketing & Promotions Module

A full Phase 3 marketing suite for the admin dashboard, covering coupons, flash sales & banners, notifications, homepage slots, referrals, and loyalty.

## Scope

Six sub-modules under a new `/admin/marketing` route, each as its own tab/page:

1. **Coupons & Discount Codes**
2. **Flash Sales & Banners**
3. **Push & Email Notifications**
4. **Homepage & Featured Slots**
5. **Referral Program**
6. **Loyalty & Rewards**

All actions write to `audit_log` via the existing helper. All lists use the existing `TablePagination` + `usePagination` patterns. Design uses existing semantic tokens.

---

## Database (one migration)

New enums:
- `discount_type` — `percentage | fixed`
- `coupon_status` — `active | paused | expired`
- `notification_channel` — `push | email`
- `notification_status` — `draft | scheduled | sent`
- `featured_slot_type` — `product | seller | category`

New tables (all with RLS — admins manage, public/shoppers read where relevant):

- `coupons` — code, discount_type, discount_value, min_order_value, max_uses, used_count, expires_at, status, applicable_sellers (uuid[]), applicable_categories (uuid[])
- `coupon_redemptions` — coupon_id, order_id, shopper_id, discount_applied, redeemed_at (for usage stats)
- `flash_sales` — title, description, starts_at, ends_at, discount_percentage, product_ids (uuid[]), status
- `banners` — title, image_desktop_url, image_mobile_url, link_url, sort_order, starts_at, ends_at, active
- `notifications` — channel, audience (`all_shoppers | all_sellers | segment`), segment_filter (jsonb), subject, body, template_key, scheduled_for, sent_at, status, open_count, click_count, recipient_count
- `notification_templates` — key, name, subject, body
- `featured_slots` — slot_type, entity_id, position, starts_at, ends_at
- `referral_config` — single-row: referrer_reward, referee_reward, expiry_days, max_per_user
- `referrals` — referrer_id, referee_id, status (`pending | completed | expired`), reward_paid, completed_at
- `loyalty_config` — single-row: points_per_dollar, redemption_rate, expiry_months
- `loyalty_points` — user_id, balance, lifetime_earned
- `loyalty_adjustments` — user_id, admin_id, delta, reason, created_at

New storage bucket: `marketing-banners` (public).

## Frontend pages

```
src/pages/admin/marketing/
  Marketing.tsx          // tabs container
  Coupons.tsx            // list + create dialog + detail drawer with stats
  FlashSales.tsx         // list + create/edit dialog
  Banners.tsx            // grid with upload + schedule
  Notifications.tsx      // composer + scheduled/sent list + templates
  FeaturedSlots.tsx      // dnd-kit reorder per slot type
  Referral.tsx           // config form + stats table
  Loyalty.tsx            // config form + top users + manual adjust dialog
```

Add a single `/admin/marketing` route in `App.tsx` with nested tabs (so the sidebar gets one entry). Add a "Marketing" group in `AppSidebar.tsx` gated by `marketing_admin` or `super_admin`.

## Seed data

Seed via insert tool after migration approval: 6 coupons (mix of active/expired/paused with redemptions), 2 flash sales, 4 banners, 5 notifications (sent + scheduled), 3 featured slots per type, referral + loyalty config rows, 12 loyalty balances, sample referrals.

## Out of scope (call out to user)

- Real push delivery (FCM/APNs) and real email send — records are written and "sent" is simulated; wiring to a provider is a follow-up.
- Real-time storefront rendering of banners/featured slots — schema is ready; storefront isn't built yet.
- Open/click tracking pixels — counts are stored but require a tracking endpoint to populate.

## Files

- new migration (schema + RLS + bucket + policies)
- 8 new pages under `src/pages/admin/marketing/`
- edits: `src/App.tsx`, `src/components/AppSidebar.tsx`
- new dependency: `@dnd-kit/core` + `@dnd-kit/sortable` for Featured Slots reorder

Approve and I'll ship it.
