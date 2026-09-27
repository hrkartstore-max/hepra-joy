create table if not exists public.shipments (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, order_id uuid not null references public.orders(id) on delete cascade,
 provider text not null default 'shiprocket', provider_order_id text, shipment_id text, awb text, courier_name text, courier_id text,
 status text not null default 'pending' check(status in ('pending','ready_to_ship','pickup_scheduled','in_transit','out_for_delivery','delivered','cancelled','returned','ndr','failed')),
 payment_mode text check(payment_mode in ('COD','Prepaid')), shipping_charge numeric(14,2) not null default 0, cod_charge numeric(14,2) not null default 0,
 label_url text, tracking_url text, pickup_location text, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.shipment_events (
 id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade, provider text not null default 'shiprocket',
 event_id text, event_type text not null, status text, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(provider,event_id));
create index if not exists shipments_store_status_idx on public.shipments(store_id,status);
create index if not exists shipments_order_idx on public.shipments(order_id);
create index if not exists shipments_awb_idx on public.shipments(awb);
create index if not exists shipment_events_shipment_date_idx on public.shipment_events(shipment_id,created_at desc);
alter table public.shipments enable row level security; alter table public.shipment_events enable row level security;
create policy "shipments_member_read" on public.shipments for select using (public.is_store_member(store_id));
create policy "shipments_admin_write" on public.shipments for all using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "shipment_events_member_read" on public.shipment_events for select using (exists(select 1 from shipments s where s.id=shipment_id and public.is_store_member(s.store_id)));
create policy "shipment_events_admin_write" on public.shipment_events for all using (exists(select 1 from shipments s where s.id=shipment_id and public.is_store_admin(s.store_id))) with check (exists(select 1 from shipments s where s.id=shipment_id and public.is_store_admin(s.store_id)));
