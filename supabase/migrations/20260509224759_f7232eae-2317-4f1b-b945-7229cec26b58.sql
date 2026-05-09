grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.is_finance_admin(uuid) to anon, authenticated;