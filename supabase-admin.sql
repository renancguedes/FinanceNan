-- ============================================================================
-- FinanceNan — Perfis, aprovação de cadastro e admin (rode no SQL Editor).
-- ============================================================================
create table if not exists public.fn_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  role       text not null default 'user',       -- 'user' | 'admin'
  approved   boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

-- Checa admin sem recursão de RLS.
create or replace function public.fn_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.fn_profiles where id = auth.uid() and role = 'admin');
$$;

-- Impede usuário comum de se auto-aprovar ou virar admin.
create or replace function public.fn_profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.fn_is_admin() then
    if tg_op = 'INSERT' then
      new.id := auth.uid(); new.role := 'user'; new.approved := false;
    else
      new.role := old.role; new.approved := old.approved;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fn_profiles_guard_trg on public.fn_profiles;
create trigger fn_profiles_guard_trg before insert or update on public.fn_profiles
  for each row execute function public.fn_profiles_guard();

alter table public.fn_profiles enable row level security;
drop policy if exists "profiles_select" on public.fn_profiles;
drop policy if exists "profiles_insert" on public.fn_profiles;
drop policy if exists "profiles_update" on public.fn_profiles;
drop policy if exists "profiles_delete" on public.fn_profiles;
create policy "profiles_select" on public.fn_profiles for select using (id = auth.uid() or public.fn_is_admin());
create policy "profiles_insert" on public.fn_profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.fn_profiles for update using (id = auth.uid() or public.fn_is_admin()) with check (id = auth.uid() or public.fn_is_admin());
create policy "profiles_delete" on public.fn_profiles for delete using (public.fn_is_admin());

-- Bootstrap do admin (se o usuário já existir em auth.users).
insert into public.fn_profiles (id, name, email, role, approved)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)), u.email, 'admin', true
from auth.users u where lower(u.email) = 'renanguedesrdg@gmail.com'
on conflict (id) do update set role = 'admin', approved = true;
