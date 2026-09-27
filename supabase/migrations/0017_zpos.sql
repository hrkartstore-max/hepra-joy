create table if not exists public.pos_sessions (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 user_id uuid not null references auth.users(id), status text not null default 'open' check(status in ('open','held','completed','void')),
 customer_id uuid references public.customers(id) on delete set null, currency text not null default 'INR',
 subtotal numeric(14,2) not null default 0, discount_total numeric(14,2) not null default 0, tax_total numeric(14,2) not null default 0,
 total numeric(14,2) not null default 0, payment_method text check(payment_method in ('UPI','CASH','CARD')),
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.pos_items (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.pos_sessions(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, variant_id uuid references public.variants(id) on delete set null,
 name text not null, sku text, quantity integer not null check(quantity>0), unit_price numeric(14,2) not null check(unit_price>=0),
 discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, created_at timestamptz not null default now());
create table if not exists public.pos_held_orders (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 session_id uuid not null references public.pos_sessions(id) on delete cascade, label text, created_at timestamptz not null default now());
create index if not exists pos_sessions_store_status_idx on public.pos_sessions(store_id,status);
create index if not exists pos_items_session_idx on public.pos_items(session_id);
alter table public.pos_sessions enable row level security; alter table public.pos_items enable row level security; alter table public.pos_held_orders enable row level security;
create policy "pos_sessions_member" on public.pos_sessions for all using(public.is_store_member(store_id)) with check(public.is_store_member(store_id));
create policy "pos_items_member" on public.pos_items for all using(exists(select 1 from pos_sessions p where p.id=session_id and public.is_store_member(p.store_id))) with check(exists(select 1 from pos_sessions p where p.id=session_id and public.is_store_member(p.store_id)));
create policy "pos_held_member" on public.pos_held_orders for all using(public.is_store_member(store_id)) with check(public.is_store_member(store_id));
