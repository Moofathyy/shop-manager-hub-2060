revoke execute on function private.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function private.is_admin(uuid) from public, anon, authenticated;
revoke execute on function private.is_finance_admin(uuid) from public, anon, authenticated;

revoke all on schema private from public, anon, authenticated;