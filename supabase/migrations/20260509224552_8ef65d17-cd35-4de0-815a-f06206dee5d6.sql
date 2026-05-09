create schema if not exists private;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function private.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('super_admin', 'finance_admin', 'support_agent', 'moderator', 'marketing_admin')
  );
$$;

create or replace function private.is_finance_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('super_admin', 'finance_admin')
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.is_finance_admin(uuid) to authenticated;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.has_role(_user_id, _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_admin(_user_id);
$$;

create or replace function public.is_finance_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_finance_admin(_user_id);
$$;