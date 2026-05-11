
ALTER TABLE public.merchant_applications 
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS kyc_result jsonb;

-- Seed demo values for existing apps
UPDATE public.merchant_applications
SET business_type = COALESCE(business_type, (ARRAY['LLC','Sole Proprietor','Corporation','Partnership','Freelancer'])[1 + (abs(hashtext(id::text)) % 5)]),
    kyc_result = COALESCE(kyc_result, jsonb_build_object(
      'provider','Sumsub',
      'status', (ARRAY['verified','review','failed','pending'])[1 + (abs(hashtext(id::text)) % 4)],
      'score', 50 + (abs(hashtext(id::text)) % 50),
      'checked_at', now()
    ));

-- Seed countries on seller profiles if missing
UPDATE public.profiles p
SET country = (ARRAY['US','UK','UAE','SA','EG','DE','FR','IN'])[1 + (abs(hashtext(p.id::text)) % 8)]
WHERE country IS NULL AND p.id IN (SELECT user_id FROM public.seller_profiles);

-- Seed sample documents for applications that have none
UPDATE public.merchant_applications
SET documents = '[
  {"name":"Business Registration","url":"#","type":"registration"},
  {"name":"Owner ID","url":"#","type":"id"},
  {"name":"Bank Account Details","url":"#","type":"bank"}
]'::jsonb
WHERE documents = '[]'::jsonb OR jsonb_array_length(documents) = 0;
