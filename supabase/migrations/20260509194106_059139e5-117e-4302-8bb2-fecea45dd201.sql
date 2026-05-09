
-- Roles enum and table (separate to prevent privilege escalation)
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 'finance_admin', 'support_agent', 'moderator', 'marketing_admin', 'shopper', 'seller'
);

CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'needs_info');
CREATE TYPE public.product_status AS ENUM ('pending', 'approved', 'rejected', 'unpublished', 'out_of_stock');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned', 'disputed');
CREATE TYPE public.kyc_status AS ENUM ('not_submitted', 'submitted', 'verified', 'failed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  country TEXT,
  status public.user_status NOT NULL DEFAULT 'active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','finance_admin','support_agent','moderator','marketing_admin')
  )
$$;

-- Seller profiles
CREATE TABLE public.seller_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  business_name TEXT,
  tax_id TEXT,
  address TEXT,
  kyc_status public.kyc_status NOT NULL DEFAULT 'not_submitted',
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  payout_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.merchant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.approval_status NOT NULL DEFAULT 'pending',
  decision_reason TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price NUMERIC(12,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  status public.product_status NOT NULL DEFAULT 'pending',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason TEXT,
  sales_count INT NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  shipping_status TEXT NOT NULL DEFAULT 'not_shipped',
  shipping_address JSONB,
  payment_method TEXT,
  tracking_number TEXT,
  carrier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty INT NOT NULL,
  price NUMERIC(12,2) NOT NULL
);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_seller_profiles BEFORE UPDATE ON public.seller_profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  -- Default new signups to shopper role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shopper');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "self can view profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "self can update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_roles policies
CREATE POLICY "self view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "super admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- seller_profiles
CREATE POLICY "seller manage own" ON public.seller_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view sellers" ON public.seller_profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update sellers" ON public.seller_profiles FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "public view approved sellers" ON public.seller_profiles FOR SELECT USING (approval_status = 'approved');

-- merchant_applications
CREATE POLICY "seller manage own application" ON public.merchant_applications FOR ALL
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "admins view applications" ON public.merchant_applications FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update applications" ON public.merchant_applications FOR UPDATE USING (public.is_admin(auth.uid()));

-- categories (public read, admin write)
CREATE POLICY "public view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "admins manage categories" ON public.categories FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- products
CREATE POLICY "public view approved products" ON public.products FOR SELECT USING (status = 'approved');
CREATE POLICY "seller manage own products" ON public.products FOR ALL
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "admins view products" ON public.products FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update products" ON public.products FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "admins delete products" ON public.products FOR DELETE USING (public.is_admin(auth.uid()));

-- orders
CREATE POLICY "shopper view own orders" ON public.orders FOR SELECT USING (auth.uid() = shopper_id);
CREATE POLICY "seller view own orders" ON public.orders FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "shopper create order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = shopper_id);
CREATE POLICY "admins view orders" ON public.orders FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update orders" ON public.orders FOR UPDATE USING (public.is_admin(auth.uid()));

-- order_items
CREATE POLICY "view items via order" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.shopper_id = auth.uid() OR o.seller_id = auth.uid() OR public.is_admin(auth.uid())))
);
CREATE POLICY "shopper insert items" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.shopper_id = auth.uid())
);

-- audit_log
CREATE POLICY "admins view audit" ON public.audit_log FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins insert audit" ON public.audit_log FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images', 'product-images', true),
  ('merchant-docs', 'merchant-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "sellers upload product images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "sellers manage own product images" ON storage.objects FOR ALL
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "seller read own docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "admins read all docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-docs' AND public.is_admin(auth.uid()));
CREATE POLICY "seller upload own docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'merchant-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indexes
CREATE INDEX idx_products_seller ON public.products(seller_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_orders_shopper ON public.orders(shopper_id);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
