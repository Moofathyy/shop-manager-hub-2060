-- Enums
CREATE TYPE public.shipment_status AS ENUM ('pending','in_transit','delivered','delayed','failed','returned');
CREATE TYPE public.return_status AS ENUM ('requested','approved','rejected','label_issued','in_transit','received','refunded');
CREATE TYPE public.rate_type AS ENUM ('flat','weight','free');

-- Carriers
CREATE TABLE public.shipping_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  api_key TEXT,
  regions TEXT[] NOT NULL DEFAULT '{}',
  default_for_regions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage carriers" ON public.shipping_carriers FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "public view active carriers" ON public.shipping_carriers FOR SELECT USING (active);
CREATE TRIGGER shipping_carriers_updated_at BEFORE UPDATE ON public.shipping_carriers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Zones
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  countries TEXT[] NOT NULL DEFAULT '{}',
  regions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage zones" ON public.delivery_zones FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "public view active zones" ON public.delivery_zones FOR SELECT USING (active);
CREATE TRIGGER delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Rates
CREATE TABLE public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL,
  carrier_id UUID,
  rate_type public.rate_type NOT NULL,
  flat_amount NUMERIC,
  weight_brackets JSONB NOT NULL DEFAULT '[]'::jsonb,
  seller_tier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage rates" ON public.shipping_rates FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "public view active rates" ON public.shipping_rates FOR SELECT USING (active);
CREATE TRIGGER shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Shipments
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  carrier_id UUID,
  zone_id UUID,
  tracking_number TEXT,
  status public.shipment_status NOT NULL DEFAULT 'pending',
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failure_reason TEXT,
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage shipments" ON public.shipments FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "party view shipment" ON public.shipments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipments.order_id AND (o.shopper_id = auth.uid() OR o.seller_id = auth.uid()))
);
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Shipment events
CREATE TABLE public.shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL,
  status public.shipment_status NOT NULL,
  location TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage events" ON public.shipment_events FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "party view events" ON public.shipment_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.shipments s
    JOIN public.orders o ON o.id = s.order_id
    WHERE s.id = shipment_events.shipment_id AND (o.shopper_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- Returns
CREATE TABLE public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  shopper_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  return_tracking_number TEXT,
  label_url TEXT,
  refund_amount NUMERIC,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage returns" ON public.return_requests FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "shopper create return" ON public.return_requests FOR INSERT WITH CHECK (auth.uid() = shopper_id);
CREATE POLICY "party view return" ON public.return_requests FOR SELECT USING (auth.uid() = shopper_id OR auth.uid() = seller_id);
CREATE TRIGGER return_requests_updated_at BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed
INSERT INTO public.shipping_carriers (name, code, api_key, regions, default_for_regions) VALUES
  ('DHL Express', 'dhl', 'sk_dhl_demo_xxxx', ARRAY['EU','ME','NA','APAC'], ARRAY['EU']),
  ('FedEx', 'fedex', 'sk_fedex_demo_xxxx', ARRAY['NA','EU','APAC'], ARRAY['NA']),
  ('Aramex', 'aramex', 'sk_aramex_demo_xxxx', ARRAY['ME','APAC'], ARRAY['ME']),
  ('Local Courier', 'local', NULL, ARRAY['ME'], ARRAY[]::text[]);

INSERT INTO public.delivery_zones (name, countries, regions) VALUES
  ('North America', ARRAY['US','CA','MX'], ARRAY['NA']),
  ('Europe', ARRAY['DE','FR','IT','ES','GB','NL'], ARRAY['EU']),
  ('Middle East', ARRAY['SA','AE','EG','JO','QA'], ARRAY['ME']),
  ('Asia Pacific', ARRAY['SG','JP','AU','IN'], ARRAY['APAC']);

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'flat'::rate_type, 9.99, '[]'::jsonb, NULL
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='fedex' WHERE z.name='North America';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'weight'::rate_type, NULL, '[{"maxKg":1,"price":5},{"maxKg":5,"price":12},{"maxKg":20,"price":28}]'::jsonb, NULL
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='dhl' WHERE z.name='Europe';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'flat'::rate_type, 4.50, '[]'::jsonb, NULL
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='aramex' WHERE z.name='Middle East';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'free'::rate_type, NULL, '[]'::jsonb, 'premium'
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='aramex' WHERE z.name='Middle East';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'weight'::rate_type, NULL, '[{"maxKg":1,"price":8},{"maxKg":5,"price":18},{"maxKg":20,"price":40}]'::jsonb, NULL
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='dhl' WHERE z.name='Asia Pacific';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'flat'::rate_type, 14.99, '[]'::jsonb, 'standard'
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='dhl' WHERE z.name='North America';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'free'::rate_type, NULL, '[]'::jsonb, 'enterprise'
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='fedex' WHERE z.name='North America';

INSERT INTO public.shipping_rates (zone_id, carrier_id, rate_type, flat_amount, weight_brackets, seller_tier)
SELECT z.id, c.id, 'flat'::rate_type, 6.00, '[]'::jsonb, NULL
FROM public.delivery_zones z JOIN public.shipping_carriers c ON c.code='local' WHERE z.name='Middle East';

-- Shipments seed (link to existing orders if available, else freestanding)
WITH ord AS (SELECT id, created_at FROM public.orders ORDER BY created_at DESC LIMIT 12),
     car AS (SELECT id, code FROM public.shipping_carriers),
     zon AS (SELECT id, name FROM public.delivery_zones)
INSERT INTO public.shipments (order_id, carrier_id, zone_id, tracking_number, status, estimated_delivery, delivered_at, failure_reason, cost)
SELECT o.id,
  (SELECT id FROM car ORDER BY random() LIMIT 1),
  (SELECT id FROM zon ORDER BY random() LIMIT 1),
  'TRK' || upper(substr(md5(random()::text), 1, 10)),
  CASE (random()*5)::int
    WHEN 0 THEN 'pending'::shipment_status
    WHEN 1 THEN 'in_transit'::shipment_status
    WHEN 2 THEN 'delivered'::shipment_status
    WHEN 3 THEN 'delayed'::shipment_status
    WHEN 4 THEN 'failed'::shipment_status
    ELSE 'in_transit'::shipment_status
  END,
  now() + (random()*7)::int * interval '1 day',
  CASE WHEN random() < 0.3 THEN now() - (random()*3)::int * interval '1 day' ELSE NULL END,
  CASE WHEN random() < 0.15 THEN 'Recipient unavailable' ELSE NULL END,
  round((random()*30 + 5)::numeric, 2)
FROM ord o;

-- If no orders, insert 6 freestanding shipments so the dashboard isn't empty
INSERT INTO public.shipments (carrier_id, zone_id, tracking_number, status, estimated_delivery, cost)
SELECT
  (SELECT id FROM public.shipping_carriers ORDER BY random() LIMIT 1),
  (SELECT id FROM public.delivery_zones ORDER BY random() LIMIT 1),
  'TRK' || upper(substr(md5(random()::text || g::text), 1, 10)),
  (ARRAY['pending','in_transit','delivered','delayed','failed']::shipment_status[])[1 + (random()*4)::int],
  now() + (g)::int * interval '1 day',
  round((random()*30 + 5)::numeric, 2)
FROM generate_series(1, 6) g
WHERE NOT EXISTS (SELECT 1 FROM public.shipments);

-- Tracking events for first few shipments
INSERT INTO public.shipment_events (shipment_id, status, location, note, created_at)
SELECT s.id, 'pending'::shipment_status, 'Origin warehouse', 'Label created', s.created_at
FROM public.shipments s;

INSERT INTO public.shipment_events (shipment_id, status, location, note, created_at)
SELECT s.id, 'in_transit'::shipment_status, 'Sorting facility', 'Departed origin', s.created_at + interval '4 hours'
FROM public.shipments s WHERE s.status IN ('in_transit','delivered','delayed');

INSERT INTO public.shipment_events (shipment_id, status, location, note, created_at)
SELECT s.id, 'delivered'::shipment_status, 'Destination', 'Delivered to recipient', COALESCE(s.delivered_at, s.created_at + interval '3 days')
FROM public.shipments s WHERE s.status = 'delivered';

INSERT INTO public.shipment_events (shipment_id, status, location, note, created_at)
SELECT s.id, 'failed'::shipment_status, 'Local hub', COALESCE(s.failure_reason, 'Delivery failed'), s.created_at + interval '2 days'
FROM public.shipments s WHERE s.status = 'failed';

-- Return requests seed (only if orders exist)
WITH ord AS (SELECT id, shopper_id, seller_id, total FROM public.orders ORDER BY created_at DESC LIMIT 5)
INSERT INTO public.return_requests (order_id, shopper_id, seller_id, reason, status, refund_amount)
SELECT o.id, o.shopper_id, o.seller_id,
  (ARRAY['Item damaged','Wrong size','Not as described','Changed mind','Defective product'])[1 + (random()*4)::int],
  (ARRAY['requested','approved','label_issued','received','refunded']::return_status[])[1 + (random()*4)::int],
  o.total
FROM ord o;