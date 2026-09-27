-- Phase 6: public storefront read model and navigation.
create table if not exists public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  location text not null default 'header',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, location)
);
create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  menu_id uuid not null references public.navigation_menus(id) on delete cascade,
  parent_id uuid references public.navigation_items(id) on delete set null,
  label text not null,
  href text,
  position integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists navigation_items_menu_position_idx on public.navigation_items(menu_id,position);

alter table public.navigation_menus enable row level security;
alter table public.navigation_items enable row level security;

create policy "navigation_menus_member" on public.navigation_menus for select using (public.is_store_member(store_id));
create policy "navigation_menus_admin_write" on public.navigation_menus for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "navigation_items_member" on public.navigation_items for select using (public.is_store_member(store_id));
create policy "navigation_items_admin_write" on public.navigation_items for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- Public storefront access is restricted to active stores and published/visible commerce content.
create policy "stores_public_active" on public.stores for select using (status = 'active');

create policy "store_settings_public_active" on public.store_settings for select using (
  exists (select 1 from public.stores s where s.id=store_id and s.status='active')
);
create policy "products_public_active" on public.products for select using (
  status='active' and exists (select 1 from public.stores s where s.id=store_id and s.status='active')
);
create policy "variants_public_active" on public.variants for select using (
  exists (
    select 1 from public.products p join public.stores s on s.id=p.store_id
    where p.id=product_id and p.status='active' and s.status='active'
  )
);
create policy "images_public_active" on public.images for select using (
  exists (
    select 1 from public.products p join public.stores s on s.id=p.store_id
    where p.id=product_id and p.status='active' and s.status='active'
  )
);
create policy "categories_public_visible" on public.categories for select using (
  visible=true and exists (select 1 from public.stores s where s.id=store_id and s.status='active')
);
create policy "category_products_public_active" on public.category_products for select using (
  exists (
    select 1 from public.products p join public.stores s on s.id=p.store_id
    where p.id=product_id and p.status='active' and s.status='active'
  ) and exists (
    select 1 from public.categories c where c.id=category_id and c.visible=true
  )
);
create policy "pages_public_published" on public.pages for select using (
  status='published' and exists (select 1 from public.stores s where s.id=store_id and s.status='active')
);
create policy "page_sections_public_published" on public.page_sections for select using (
  exists (
    select 1 from public.pages p join public.stores s on s.id=p.store_id
    where p.id=page_id and p.status='published' and s.status='active'
  )
);
create policy "navigation_menus_public_active" on public.navigation_menus for select using (
  exists (select 1 from public.stores s where s.id=store_id and s.status='active')
);
create policy "navigation_items_public_active" on public.navigation_items for select using (
  visible=true and exists (
    select 1 from public.stores s where s.id=store_id and s.status='active'
  )
);
