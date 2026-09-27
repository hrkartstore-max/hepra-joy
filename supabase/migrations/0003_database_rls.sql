-- Phase 3: Database model + tenant RLS
-- Based on the authoritative ZSITE / HEPRA master prompt.

create table if not exists public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table if not exists public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  business_name text,
  category text,
  logo_url text,
  favicon_url text,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb,
  gstin text,
  currency text not null default 'INR',
  language text not null default 'en',
  branding jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text,
  preview_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.theme_versions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  version text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(theme_id, version)
);

create table if not exists public.store_themes (
  store_id uuid primary key references public.stores(id) on delete cascade,
  theme_id uuid not null references public.themes(id),
  theme_version_id uuid references public.theme_versions(id),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, slug)
);

create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  section_type text not null,
  position integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  slug text not null,
  sku text,
  description text,
  price numeric(14,2) not null default 0 check (price >= 0),
  compare_at_price numeric(14,2),
  cost numeric(14,2),
  stock integer not null default 0 check (stock >= 0),
  brand text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  seo jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, slug),
  unique(store_id, sku)
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  sku text,
  price numeric(14,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  barcode text,
  options jsonb not null default '{}'::jsonb,
  weight numeric(12,3),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, sku)
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  seo jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, slug)
);

create table if not exists public.category_products (
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(category_id, product_id)
);

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  type text not null check (type in ('percentage','fixed','buy_x_get_y')),
  value numeric(14,2) not null default 0,
  minimum_order numeric(14,2),
  maximum_discount numeric(14,2),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  automatic boolean not null default false,
  active boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  discount_id uuid not null references public.discounts(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  recipient_name text,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'IN',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  session_key text,
  status text not null default 'active' check (status in ('active','converted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.variants(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_number text not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','authorized','paid','failed','refunded','partially_refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','processing','fulfilled','cancelled','returned')),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  shipping_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'INR',
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  tax_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, order_number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.variants(id),
  product_name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  tax_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete cascade,
  available integer not null default 0 check (available >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  check (product_id is not null or variant_id is not null)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  quantity_delta integer not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  provider text,
  provider_payment_id text,
  status text not null default 'pending',
  amount numeric(14,2) not null default 0,
  currency text not null default 'INR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_code text not null,
  status text not null default 'TRIAL' check (status in ('TRIAL','ACTIVE','PAST_DUE','PAUSED','CANCELLED','EXPIRED')),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  provider text not null,
  event_id text not null,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processing','processed','failed','ignored')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, event_id)
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_members_user_idx on public.store_members(user_id);
create index if not exists products_store_status_idx on public.products(store_id,status);
create index if not exists products_store_sku_idx on public.products(store_id,sku);
create index if not exists variants_store_product_idx on public.variants(store_id,product_id);
create index if not exists categories_store_parent_idx on public.categories(store_id,parent_id);
create index if not exists discounts_store_active_idx on public.discounts(store_id,active);
create index if not exists customers_store_email_idx on public.customers(store_id,email);
create index if not exists orders_store_created_idx on public.orders(store_id,created_at desc);
create index if not exists orders_store_customer_idx on public.orders(store_id,customer_id);
create index if not exists order_items_store_order_idx on public.order_items(store_id,order_id);
create index if not exists payments_store_status_idx on public.payments(store_id,status);
create index if not exists inventory_store_product_idx on public.inventory(store_id,product_id);
create index if not exists inventory_movements_store_date_idx on public.inventory_movements(store_id,created_at desc);
create index if not exists audit_logs_store_date_idx on public.audit_logs(store_id,created_at desc);
create index if not exists webhook_events_store_date_idx on public.webhook_events(store_id,received_at desc);

create or replace function public.is_store_member(target_store uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.store_members
    where store_id = target_store and user_id = auth.uid()
  ) or exists (
    select 1 from public.stores s
    join public.organization_members om on om.organization_id=s.organization_id
    where s.id=target_store and om.user_id=auth.uid()
  );
$$;

create or replace function public.is_store_admin(target_store uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.store_members
    where store_id = target_store and user_id = auth.uid() and role in ('owner','admin')
  ) or exists (
    select 1 from public.stores s
    join public.organization_members om on om.organization_id=s.organization_id
    where s.id=target_store and om.user_id=auth.uid() and om.role in ('owner','admin')
  );
$$;

alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.themes enable row level security;
alter table public.theme_versions enable row level security;
alter table public.store_themes enable row level security;
alter table public.pages enable row level security;
alter table public.page_sections enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.images enable row level security;
alter table public.categories enable row level security;
alter table public.category_products enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_codes enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.feature_flags enable row level security;

create policy "store_members_select" on public.store_members for select using (public.is_store_member(store_id));
create policy "store_members_admin_insert" on public.store_members for insert with check (public.is_store_admin(store_id));
create policy "store_members_admin_update" on public.store_members for update using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "store_members_admin_delete" on public.store_members for delete using (public.is_store_admin(store_id));

create policy "store_settings_member" on public.store_settings for select using (public.is_store_member(store_id));
create policy "store_settings_admin_write" on public.store_settings for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "store_themes_member" on public.store_themes for select using (public.is_store_member(store_id));
create policy "store_themes_admin_write" on public.store_themes for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "pages_member" on public.pages for select using (public.is_store_member(store_id));
create policy "pages_admin_write" on public.pages for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "page_sections_member" on public.page_sections for select using (public.is_store_member(store_id));
create policy "page_sections_admin_write" on public.page_sections for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "products_member" on public.products for select using (public.is_store_member(store_id));
create policy "products_admin_write" on public.products for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "variants_member" on public.variants for select using (public.is_store_member(store_id));
create policy "variants_admin_write" on public.variants for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "images_member" on public.images for select using (public.is_store_member(store_id));
create policy "images_admin_write" on public.images for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "categories_member" on public.categories for select using (public.is_store_member(store_id));
create policy "categories_admin_write" on public.categories for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "category_products_member" on public.category_products for select using (public.is_store_member(store_id));
create policy "category_products_admin_write" on public.category_products for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "discounts_member" on public.discounts for select using (public.is_store_member(store_id));
create policy "discounts_admin_write" on public.discounts for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "discount_codes_member" on public.discount_codes for select using (public.is_store_member(store_id));
create policy "discount_codes_admin_write" on public.discount_codes for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "customers_member" on public.customers for select using (public.is_store_member(store_id));
create policy "customers_admin_write" on public.customers for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "addresses_member" on public.addresses for select using (public.is_store_member(store_id));
create policy "addresses_admin_write" on public.addresses for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "carts_member" on public.carts for select using (public.is_store_member(store_id));
create policy "carts_admin_write" on public.carts for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "cart_items_member" on public.cart_items for select using (public.is_store_member(store_id));
create policy "cart_items_admin_write" on public.cart_items for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "orders_member" on public.orders for select using (public.is_store_member(store_id));
create policy "orders_admin_write" on public.orders for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "order_items_member" on public.order_items for select using (public.is_store_member(store_id));
create policy "order_items_admin_write" on public.order_items for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "inventory_member" on public.inventory for select using (public.is_store_member(store_id));
create policy "inventory_admin_write" on public.inventory for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "inventory_movements_member" on public.inventory_movements for select using (public.is_store_member(store_id));
create policy "inventory_movements_admin_write" on public.inventory_movements for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

create policy "payments_member" on public.payments for select using (public.is_store_member(store_id));
create policy "payments_admin_write" on public.payments for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "payment_events_admin" on public.payment_events for select using (public.is_store_admin(store_id));
create policy "payment_events_write" on public.payment_events for insert with check (public.is_store_admin(store_id));

create policy "subscriptions_org_member" on public.subscriptions for select using (public.is_org_member(organization_id));
create policy "subscriptions_org_admin" on public.subscriptions for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "audit_logs_member" on public.audit_logs for select using (
  store_id is not null and public.is_store_member(store_id)
  or organization_id is not null and public.is_org_member(organization_id)
);
create policy "webhook_events_admin" on public.webhook_events for select using (store_id is not null and public.is_store_admin(store_id));

-- Themes and feature flags are platform-managed. Authenticated users may read active catalog data.
create policy "themes_public_read" on public.themes for select using (active = true);
create policy "theme_versions_public_read" on public.theme_versions for select using (
  exists(select 1 from public.themes t where t.id=theme_id and t.active=true)
);
create policy "feature_flags_authenticated_read" on public.feature_flags for select using (auth.uid() is not null);

-- Bootstrap the first store membership when a store is created by the onboarding RPC.
create or replace function public.create_organization_with_store(
  p_organization_name text,
  p_organization_slug text,
  p_store_name text,
  p_store_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_store uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.organizations(name, slug, created_by)
  values (trim(p_organization_name), lower(trim(p_organization_slug)), v_user)
  returning id into v_org;
  insert into public.organization_members(organization_id,user_id,role)
  values (v_org,v_user,'owner');
  insert into public.stores(organization_id,name,slug)
  values (v_org,trim(p_store_name),lower(trim(p_store_slug)))
  returning id into v_store;
  insert into public.store_members(store_id,user_id,role)
  values (v_store,v_user,'owner');
  insert into public.store_settings(store_id,business_name)
  values (v_store,trim(p_store_name));
  return jsonb_build_object('organization_id',v_org,'store_id',v_store);
exception when unique_violation then
  raise exception 'SLUG_ALREADY_EXISTS';
end;
$$;

revoke all on function public.create_organization_with_store(text,text,text,text) from public;
grant execute on function public.create_organization_with_store(text,text,text,text) to authenticated;
