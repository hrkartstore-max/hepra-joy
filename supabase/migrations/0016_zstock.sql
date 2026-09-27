create table if not exists public.warehouses (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 name text not null, code text not null, address jsonb not null default '{}'::jsonb, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id,code));
create table if not exists public.warehouse_inventory (
 id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references public.warehouses(id) on delete cascade,
 product_id uuid references public.products(id) on delete cascade, variant_id uuid references public.variants(id) on delete cascade,
 available integer not null default 0 check(available>=0), reserved integer not null default 0 check(reserved>=0),
 reorder_level integer not null default 0 check(reorder_level>=0), updated_at timestamptz not null default now(),
 unique(warehouse_id,product_id,variant_id));
create table if not exists public.inventory_reservations (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade, warehouse_inventory_id uuid not null references public.warehouse_inventory(id),
 quantity integer not null check(quantity>0), status text not null default 'reserved' check(status in ('reserved','released','committed')),
 expires_at timestamptz, created_at timestamptz not null default now(), released_at timestamptz);
create index if not exists warehouses_store_idx on public.warehouses(store_id);
create index if not exists warehouse_inventory_variant_idx on public.warehouse_inventory(variant_id);
create index if not exists inventory_reservations_order_idx on public.inventory_reservations(order_id,status);
alter table public.warehouses enable row level security; alter table public.warehouse_inventory enable row level security; alter table public.inventory_reservations enable row level security;
create policy "warehouse_member_read" on public.warehouses for select using(public.is_store_member(store_id));
create policy "warehouse_admin_write" on public.warehouses for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "warehouse_inventory_member_read" on public.warehouse_inventory for select using(exists(select 1 from warehouses w where w.id=warehouse_id and public.is_store_member(w.store_id)));
create policy "warehouse_inventory_admin_write" on public.warehouse_inventory for all using(exists(select 1 from warehouses w where w.id=warehouse_id and public.is_store_admin(w.store_id))) with check(exists(select 1 from warehouses w where w.id=warehouse_id and public.is_store_admin(w.store_id)));
create policy "reservation_member_read" on public.inventory_reservations for select using(public.is_store_member(store_id));
create policy "reservation_admin_write" on public.inventory_reservations for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create or replace function public.reserve_inventory(p_store_id uuid,p_order_id uuid,p_warehouse_inventory_id uuid,p_quantity integer,p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid;
begin
 if p_quantity<=0 then raise exception 'INVALID_QUANTITY'; end if;
 update warehouse_inventory set available=available-p_quantity,reserved=reserved+p_quantity,updated_at=now()
 where id=p_warehouse_inventory_id and available>=p_quantity
 returning id into r;
 if r is null then raise exception 'INSUFFICIENT_STOCK'; end if;
 insert into inventory_reservations(store_id,order_id,warehouse_inventory_id,quantity,expires_at) values(p_store_id,p_order_id,r,p_quantity,p_expires_at) returning id into r;
 return r;
end;$$;
create or replace function public.release_inventory_reservation(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare x record;
begin
 select * into x from inventory_reservations where id=p_reservation_id and status='reserved' for update;
 if x.id is null then return false; end if;
 update warehouse_inventory set available=available+x.quantity,reserved=reserved-x.quantity,updated_at=now() where id=x.warehouse_inventory_id;
 update inventory_reservations set status='released',released_at=now() where id=x.id;
 return true;
end;$$;
revoke all on function public.reserve_inventory(uuid,uuid,uuid,integer,timestamptz) from public;
revoke all on function public.release_inventory_reservation(uuid) from public;
grant execute on function public.reserve_inventory(uuid,uuid,uuid,integer,timestamptz) to authenticated;
grant execute on function public.release_inventory_reservation(uuid) to authenticated;