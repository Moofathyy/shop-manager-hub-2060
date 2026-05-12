
-- Enums
create type public.discount_type as enum ('percentage','fixed');
create type public.coupon_status as enum ('active','paused','expired');
create type public.notification_channel as enum ('push','email');
create type public.notification_status as enum ('draft','scheduled','sent');
create type public.notification_audience as enum ('all_shoppers','all_sellers','segment');
create type public.featured_slot_type as enum ('product','seller','category');
create type public.referral_status as enum ('pending','completed','expired');
create type public.flash_sale_status as enum ('scheduled','active','ended','paused');

-- Coupons
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type discount_type not null,
  discount_value numeric not null check (discount_value >= 0),
  min_order_value numeric not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  status coupon_status not null default 'active',
  applicable_sellers uuid[] not null default '{}',
  applicable_categories uuid[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
create policy "admins manage coupons" on public.coupons for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "public view active coupons" on public.coupons for select using (status = 'active');
create trigger coupons_updated before update on public.coupons for each row execute function public.tg_set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid,
  shopper_id uuid not null,
  discount_applied numeric not null,
  redeemed_at timestamptz not null default now()
);
alter table public.coupon_redemptions enable row level security;
create policy "admins view redemptions" on public.coupon_redemptions for select using (is_admin(auth.uid()));
create policy "shopper view own redemptions" on public.coupon_redemptions for select using (auth.uid() = shopper_id);
create policy "shopper insert redemption" on public.coupon_redemptions for insert with check (auth.uid() = shopper_id);
create index on public.coupon_redemptions(coupon_id);

-- Flash sales
create table public.flash_sales (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  discount_percentage numeric not null check (discount_percentage between 0 and 100),
  product_ids uuid[] not null default '{}',
  status flash_sale_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.flash_sales enable row level security;
create policy "admins manage flash sales" on public.flash_sales for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "public view live flash sales" on public.flash_sales for select using (status in ('scheduled','active'));
create trigger flash_sales_updated before update on public.flash_sales for each row execute function public.tg_set_updated_at();

-- Banners
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_desktop_url text,
  image_mobile_url text,
  link_url text,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.banners enable row level security;
create policy "admins manage banners" on public.banners for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "public view active banners" on public.banners for select using (active);
create trigger banners_updated before update on public.banners for each row execute function public.tg_set_updated_at();

-- Notification templates
create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  channel notification_channel not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.notification_templates enable row level security;
create policy "admins manage templates" on public.notification_templates for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  channel notification_channel not null,
  audience notification_audience not null,
  segment_filter jsonb,
  subject text,
  body text not null,
  template_key text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status notification_status not null default 'draft',
  recipient_count integer not null default 0,
  open_count integer not null default 0,
  click_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "admins manage notifications" on public.notifications for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Featured slots
create table public.featured_slots (
  id uuid primary key default gen_random_uuid(),
  slot_type featured_slot_type not null,
  entity_id uuid not null,
  position integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.featured_slots enable row level security;
create policy "admins manage featured" on public.featured_slots for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "public view active featured" on public.featured_slots for select using (active);

-- Referrals
create table public.referral_config (
  id integer primary key default 1 check (id = 1),
  referrer_reward numeric not null default 10,
  referee_reward numeric not null default 5,
  expiry_days integer not null default 30,
  max_per_user integer not null default 50,
  updated_at timestamptz not null default now()
);
alter table public.referral_config enable row level security;
create policy "admins manage referral config" on public.referral_config for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "public view referral config" on public.referral_config for select using (true);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null,
  referee_id uuid not null,
  status referral_status not null default 'pending',
  reward_paid numeric not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "admins view referrals" on public.referrals for select using (is_admin(auth.uid()));
create policy "self view own referrals" on public.referrals for select using (auth.uid() = referrer_id or auth.uid() = referee_id);
create policy "admins update referrals" on public.referrals for update using (is_admin(auth.uid()));

-- Loyalty
create table public.loyalty_config (
  id integer primary key default 1 check (id = 1),
  points_per_dollar numeric not null default 1,
  redemption_rate numeric not null default 0.01,
  expiry_months integer not null default 12,
  updated_at timestamptz not null default now()
);
alter table public.loyalty_config enable row level security;
create policy "admins manage loyalty config" on public.loyalty_config for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "public view loyalty config" on public.loyalty_config for select using (true);

create table public.loyalty_points (
  user_id uuid primary key,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.loyalty_points enable row level security;
create policy "admins manage loyalty" on public.loyalty_points for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "self view loyalty" on public.loyalty_points for select using (auth.uid() = user_id);

create table public.loyalty_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  admin_id uuid,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.loyalty_adjustments enable row level security;
create policy "admins manage adjustments" on public.loyalty_adjustments for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "self view adjustments" on public.loyalty_adjustments for select using (auth.uid() = user_id);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('marketing-banners','marketing-banners',true) on conflict do nothing;

create policy "public read marketing banners" on storage.objects for select using (bucket_id = 'marketing-banners');
create policy "admins manage marketing banners" on storage.objects for all using (bucket_id = 'marketing-banners' and is_admin(auth.uid())) with check (bucket_id = 'marketing-banners' and is_admin(auth.uid()));
