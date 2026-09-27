create table if not exists public.domains (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 domain text not null, kind text not null default 'custom' check(kind in ('subdomain','custom')),
 status text not null default 'pending' check(status in ('pending','verifying','verified','active','failed','removed')),
 is_primary boolean not null default false, vercel_domain_id text, ssl_status text, verification jsonb not null default '{}'::jsonb,
 last_checked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(domain));
create table if not exists public.domain_verifications (
 id uuid primary key default gen_random_uuid(), domain_id uuid not null references public.domains(id) on delete cascade,
 method text not null, name text, value text, status text not null default 'pending', checked_at timestamptz,
 created_at timestamptz not null default now());
create unique index if not exists one_primary_domain_per_store on public.domains(store_id) where is_primary=true and status in ('verified','active');
create index if not exists domains_store_status_idx on public.domains(store_id,status);
alter table public.domains enable row level security; alter table public.domain_verifications enable row level security;
create policy "domains_member_read" on public.domains for select using(public.is_store_member(store_id));
create policy "domains_admin_write" on public.domains for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "domain_verifications_member_read" on public.domain_verifications for select using(exists(select 1 from domains d where d.id=domain_id and public.is_store_member(d.store_id)));
create policy "domain_verifications_admin_write" on public.domain_verifications for all using(exists(select 1 from domains d where d.id=domain_id and public.is_store_admin(d.store_id))) with check(exists(select 1 from domains d where d.id=domain_id and public.is_store_admin(d.store_id)));
