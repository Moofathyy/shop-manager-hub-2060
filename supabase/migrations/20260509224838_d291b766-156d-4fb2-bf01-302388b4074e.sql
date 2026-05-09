drop policy if exists "admins view all roles" on public.user_roles;
drop policy if exists "super admins manage roles" on public.user_roles;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('super_admin', 'finance_admin', 'support_agent', 'moderator', 'marketing_admin')
  );
$$;

create or replace function public.is_finance_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('super_admin', 'finance_admin')
  );
$$;

grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.is_finance_admin(uuid) to anon, authenticated;