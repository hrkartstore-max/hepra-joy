create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id);

create index if not exists stores_organization_idx
  on public.stores(organization_id);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.stores enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

create policy "profiles_select_self"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_member"
on public.organizations for select
using (public.is_org_member(id));

create policy "organizations_insert_authenticated"
on public.organizations for insert
with check (created_by = auth.uid());

create policy "organizations_update_admin"
on public.organizations for update
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy "members_select_member"
on public.organization_members for select
using (public.is_org_member(organization_id));

create policy "members_insert_admin"
on public.organization_members for insert
with check (public.is_org_admin(organization_id));

create policy "members_update_admin"
on public.organization_members for update
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "stores_select_member"
on public.stores for select
using (public.is_org_member(organization_id));

create policy "stores_insert_admin"
on public.stores for insert
with check (public.is_org_admin(organization_id));

create policy "stores_update_admin"
on public.stores for update
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
