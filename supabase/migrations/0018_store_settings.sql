create table if not exists public.store_settings (
 id uuid primary key default gen_random_uuid(), store_id uuid not null unique references public.stores(id) on delete cascade,
 business_name text, logo_url text, favicon_url text, primary_color text, secondary_color text, typography text,
 navigation jsonb not null default '[]'::jsonb, footer jsonb not null default '{}'::jsonb, social_links jsonb not null default '{}'::jsonb,
 contact_info jsonb not null default '{}'::jsonb, seo jsonb not null default '{}'::jsonb, policies jsonb not null default '{}'::jsonb,
 checkout jsonb not null default '{}'::jsonb, payments jsonb not null default '{}'::jsonb, shipping jsonb not null default '{}'::jsonb,
 notifications jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
alter table public.store_settings enable row level security;
create policy "store_settings_member_read" on public.store_settings for select using(public.is_store_member(store_id));
create policy "store_settings_admin_write" on public.store_settings for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
