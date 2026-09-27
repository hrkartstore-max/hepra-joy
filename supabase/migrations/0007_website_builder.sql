-- Phase 8: visual website builder persistence, version history and public published sections.
create table if not exists public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  version integer not null,
  sections jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(page_id, version)
);
create index if not exists page_versions_store_page_idx on public.page_versions(store_id,page_id,version desc);

alter table public.page_versions enable row level security;
create policy "page_versions_member" on public.page_versions for select using (public.is_store_member(store_id));
create policy "page_versions_admin_write" on public.page_versions for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

drop policy if exists "pages_public_published" on public.pages;
create policy "pages_public_published" on public.pages for select using (
  status='published' and exists(select 1 from public.stores s where s.id=pages.store_id and s.status='active')
);
drop policy if exists "page_sections_public_published" on public.page_sections;
create policy "page_sections_public_published" on public.page_sections for select using (
  exists(select 1 from public.pages p join public.stores s on s.id=p.store_id where p.id=page_sections.page_id and p.status='published' and s.status='active')
);