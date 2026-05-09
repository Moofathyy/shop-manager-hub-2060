
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

INSERT INTO public.categories (name, slug, sort_order) VALUES
('Electronics','electronics',1),('Fashion','fashion',2),('Home','home',3),
('Beauty','beauty',4),('Sports','sports',5),('Toys','toys',6),
('Books','books',7),('Grocery','grocery',8),('Health','health',9),
('Automotive','automotive',10),('Garden','garden',11),('Pets','pets',12)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  uid uuid; i int;
  shopper_names text[] := ARRAY['Sara Ahmed','Omar Hassan','Layla Mostafa','Karim Saeed','Nour Adel','Yasmin Tarek','Mohamed Ali','Hana Khaled','Ziad Samir','Mariam Fouad','Adam Nabil','Salma Hany','Youssef Magdy','Dina Wael','Tamer Ezz','Reem Ashraf','Hassan Gamal','Farah Sherif','Khaled Anwar','Aya Mounir','Ramy Sobhy','Lina Magd','Ahmed Reda','Nadine Wagdy','Bassem Helmy'];
  seller_names text[] := ARRAY['Cairo Tech','Alex Boutique','Nile Home','Pyramid Sports','Oasis Beauty','Desert Books','Red Sea Toys','Sphinx Auto'];
BEGIN
  FOR i IN 1..array_length(shopper_names,1) LOOP
    uid := gen_random_uuid();
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','shopper'||i||'@demo.test',crypt('Demo@12345',gen_salt('bf')),now(),'{"provider":"email"}','{}',now()-((i%30)*interval '1 day'),now(),'','','','');
    INSERT INTO public.profiles (id, full_name, country, status, last_login, created_at)
    VALUES (uid, shopper_names[i], (ARRAY['EG','AE','SA','KW','QA'])[1+(i%5)], 'active', now()-((i%14)*interval '1 day'), now()-((i%30)*interval '1 day'));
    INSERT INTO public.user_roles (user_id, role) VALUES (uid,'shopper');
  END LOOP;

  FOR i IN 1..array_length(seller_names,1) LOOP
    uid := gen_random_uuid();
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','seller'||i||'@demo.test',crypt('Demo@12345',gen_salt('bf')),now(),'{"provider":"email"}','{}',now()-((i*3)*interval '1 day'),now(),'','','','');
    INSERT INTO public.profiles (id, full_name, country, status, created_at)
    VALUES (uid, seller_names[i], 'EG','active', now()-((i*3)*interval '1 day'));
    INSERT INTO public.user_roles (user_id, role) VALUES (uid,'seller');
    INSERT INTO public.seller_profiles (user_id, store_name, business_name, approval_status, kyc_status, rating, total_revenue, payout_balance, commission_rate, created_at)
    VALUES (uid, seller_names[i], seller_names[i]||' LLC','approved','verified', 4.0+random(), round((random()*50000)::numeric,2), round((random()*5000)::numeric,2), 10.00, now()-((i*3)*interval '1 day'));
  END LOOP;
END $$;

INSERT INTO public.products (seller_id, category_id, title, description, sku, price, stock, status, sales_count, rating, images, created_at)
SELECT (SELECT user_id FROM public.seller_profiles ORDER BY random() LIMIT 1),
  (SELECT id FROM public.categories ORDER BY random() LIMIT 1),
  'Product '||g||' - '||(ARRAY['Pro','Max','Lite','Plus','Ultra','Mini'])[1+(g%6)],
  'High-quality demo product.','SKU-'||lpad(g::text,5,'0'),
  round((19+random()*480)::numeric,2),10+(g%90),'approved',(g*3)%200,3.5+random()*1.5,'[]'::jsonb,
  now()-((g%30)*interval '1 day')
FROM generate_series(1,40) g;

INSERT INTO public.products (seller_id, category_id, title, sku, price, stock, status, images, created_at)
SELECT (SELECT user_id FROM public.seller_profiles ORDER BY random() LIMIT 1),
  (SELECT id FROM public.categories ORDER BY random() LIMIT 1),
  'Pending Item '||g,'PND-'||lpad(g::text,4,'0'),
  round((29+random()*200)::numeric,2),25,'pending','[]'::jsonb, now()-(g*interval '6 hours')
FROM generate_series(1,6) g;

INSERT INTO public.orders (shopper_id, seller_id, status, subtotal, shipping, total, payment_status, shipping_status, created_at)
SELECT (SELECT id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.seller_profiles) ORDER BY random() LIMIT 1),
  (SELECT user_id FROM public.seller_profiles ORDER BY random() LIMIT 1),
  (ARRAY['pending','confirmed','shipped','delivered','delivered','delivered','cancelled'])[1+(g%7)]::order_status,
  round((30+random()*500)::numeric,2),round((5+random()*20)::numeric,2),0,
  (ARRAY['paid','paid','paid','pending','refunded'])[1+(g%5)],
  (ARRAY['not_shipped','in_transit','delivered'])[1+(g%3)],
  now()-((g%14)*interval '1 day')-((g%24)*interval '1 hour')
FROM generate_series(1,120) g;

UPDATE public.orders SET total = subtotal + shipping WHERE total = 0;

INSERT INTO public.transactions (user_id, order_id, type, amount, currency, status, provider, created_at)
SELECT shopper_id, id, 'payment', total, 'USD', 'succeeded', 'stripe', created_at
FROM public.orders WHERE payment_status='paid';

INSERT INTO public.refunds (order_id, requested_by, amount, reason, status, created_at)
SELECT id, shopper_id, total/2, 'Item arrived damaged', 'pending', created_at + interval '2 days'
FROM public.orders WHERE payment_status='paid' ORDER BY random() LIMIT 5;

INSERT INTO public.payouts (seller_id, amount, status, scheduled_for, created_at)
SELECT user_id, round((random()*3000+500)::numeric,2),
  (ARRAY['pending','paid','paid','on_hold'])[1+floor(random()*4)::int]::payout_status,
  current_date+7, now()-(floor(random()*10)*interval '1 day')
FROM public.seller_profiles;

INSERT INTO public.reviews (reviewer_id, target_type, target_id, rating, content, status, created_at)
SELECT (SELECT id FROM public.profiles ORDER BY random() LIMIT 1),
  'product', p.id, 3+floor(random()*3)::int,
  (ARRAY['Great quality!','Fast shipping.','Exactly as described.','Would buy again.','Could be better.'])[1+floor(random()*5)::int],
  'published', now()-(floor(random()*20)*interval '1 day')
FROM public.products p WHERE p.status='approved' ORDER BY random() LIMIT 30;

INSERT INTO public.tickets (user_id, subject, type, status, priority, created_at)
SELECT (SELECT id FROM public.profiles ORDER BY random() LIMIT 1),
  (ARRAY['Order not received','Refund request','Wrong item','Question about product','Account issue'])[1+(g%5)],
  (ARRAY['order','refund','account','other'])[1+(g%4)],
  (ARRAY['open','open','waiting','resolved','closed'])[1+(g%5)]::ticket_status,
  (ARRAY['low','medium','high','urgent'])[1+(g%4)]::ticket_priority,
  now()-(g*interval '12 hours')
FROM generate_series(1,15) g;

INSERT INTO public.merchant_applications (seller_id, documents, status, created_at)
SELECT user_id, '[{"name":"trade_license.pdf"}]'::jsonb, 'pending', now()-(floor(random()*5)*interval '1 day')
FROM public.seller_profiles ORDER BY random() LIMIT 3;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
