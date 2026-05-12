DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'demo@ejada.test';
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo@ejada.test', crypt('Demo@12345', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'demo@ejada.test'), 'email', uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('Demo@12345', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = uid;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'super_admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (id, full_name) VALUES (uid, 'Demo Admin') ON CONFLICT (id) DO NOTHING;
END $$;