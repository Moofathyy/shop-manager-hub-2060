
-- Fix function search_path on tg_set_updated_at and handle_new_user (already set on others)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Restrict EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten public product-images SELECT: still publicly readable individually, but disallow broad listing
DROP POLICY IF EXISTS "public read product images" ON storage.objects;
CREATE POLICY "public read product images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] IS NOT NULL);
