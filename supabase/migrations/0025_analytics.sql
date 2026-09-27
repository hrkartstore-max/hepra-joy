create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('page_view','product_view','search','add_to_cart','checkout','purchase')),
  path text,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.variants(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  search_query text,
  value numeric(14,2),
  currency text not null default 'INR',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists analytics_events_store_time_idx on public.analytics_events(store_id, occurred_at desc);
create index if not exists analytics_events_store_type_idx on public.analytics_events(store_id, event_type, occurred_at desc);
create index if not exists analytics_events_product_idx on public.analytics_events(store_id, product_id, occurred_at desc);
create index if not exists analytics_events_session_idx on public.analytics_events(store_id, session_id, occurred_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_public_insert on public.analytics_events;
create policy analytics_events_public_insert on public.analytics_events
for insert to anon, authenticated
with check (
  exists (select 1 from public.stores s where s.id = store_id and s.status = 'active')
  and (user_id is null or user_id = auth.uid())
);

drop policy if exists analytics_events_member_select on public.analytics_events;
create policy analytics_events_member_select on public.analytics_events
for select to authenticated
using (public.is_store_member(store_id));

create or replace function public.record_order_purchase_analytics()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_session text;
  v_method text;
begin
  v_method := coalesce(new.metadata->>'payment_method', '');
  v_session := coalesce(new.metadata->>'analytics_session_id', 'server-' || new.id::text);

  if (tg_op = 'INSERT' and v_method = 'cod')
     or (tg_op = 'UPDATE' and new.payment_status = 'paid' and old.payment_status is distinct from 'paid') then
    insert into public.analytics_events (
      store_id, session_id, user_id, event_type, path, order_id, value, currency, metadata
    )
    select
      new.store_id,
      v_session,
      c.user_id,
      'purchase',
      '/orders/' || new.order_number,
      new.id,
      new.total,
      new.currency,
      jsonb_build_object('order_number', new.order_number, 'source', 'server')
    from public.customers c
    where c.id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_purchase_analytics on public.orders;
create trigger orders_purchase_analytics
after insert or update of payment_status on public.orders
for each row execute function public.record_order_purchase_analytics();

create or replace function public.get_analytics_summary(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not public.is_store_member(p_store_id) then
    raise exception 'FORBIDDEN';
  end if;

  with events as (
    select * from public.analytics_events
    where store_id = p_store_id and occurred_at >= p_from and occurred_at < p_to
  ),
  paid_orders as (
    select id, total from public.orders
    where store_id = p_store_id and payment_status = 'paid'
      and created_at >= p_from and created_at < p_to
  ),
  cod_orders as (
    select id, total from public.orders
    where store_id = p_store_id and coalesce(metadata->>'payment_method','') = 'cod'
      and created_at >= p_from and created_at < p_to
  ),
  revenue_orders as (
    select * from paid_orders
    union
    select * from cod_orders
  ),
  funnel as (
    select
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'product_view') as product_views,
      count(*) filter (where event_type = 'search') as searches,
      count(*) filter (where event_type = 'add_to_cart') as add_to_cart,
      count(*) filter (where event_type = 'checkout') as checkouts,
      count(*) filter (where event_type = 'purchase') as purchases,
      count(distinct session_id) filter (where event_type = 'page_view') as visitor_sessions,
      count(distinct session_id) filter (where event_type = 'purchase') as purchaser_sessions
    from events
  ),
  product_rank as (
    select coalesce(oi.product_name, 'Deleted product') as name,
           sum(oi.quantity)::numeric as units,
           sum(oi.quantity * oi.unit_price)::numeric as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.store_id = p_store_id
      and (o.payment_status = 'paid' or coalesce(o.metadata->>'payment_method','') = 'cod')
      and o.created_at >= p_from and o.created_at < p_to
    group by coalesce(oi.product_name, 'Deleted product')
    order by revenue desc limit 10
  ),
  category_rank as (
    select c.name,
           sum(oi.quantity)::numeric as units,
           sum(oi.quantity * oi.unit_price)::numeric as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.category_products cp on cp.product_id = oi.product_id and cp.store_id = p_store_id
    join public.categories c on c.id = cp.category_id
    where oi.store_id = p_store_id
      and (o.payment_status = 'paid' or coalesce(o.metadata->>'payment_method','') = 'cod')
      and o.created_at >= p_from and o.created_at < p_to
    group by c.name
    order by revenue desc limit 10
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'revenue', coalesce((select sum(total) from revenue_orders), 0),
    'orders', coalesce((select count(*) from revenue_orders), 0),
    'aov', coalesce((select avg(total) from revenue_orders), 0),
    'conversion_rate', coalesce(
      round(((select purchaser_sessions from funnel)::numeric / nullif((select visitor_sessions from funnel),0) * 100), 2),
      0
    ),
    'funnel', jsonb_build_object(
      'page_views', (select page_views from funnel),
      'product_views', (select product_views from funnel),
      'searches', (select searches from funnel),
      'add_to_cart', (select add_to_cart from funnel),
      'checkouts', (select checkouts from funnel),
      'purchases', (select purchases from funnel)
    ),
    'top_products', coalesce((select jsonb_agg(to_jsonb(product_rank)) from product_rank), '[]'::jsonb),
    'top_categories', coalesce((select jsonb_agg(to_jsonb(category_rank)) from category_rank), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_analytics_summary(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_analytics_summary(uuid,timestamptz,timestamptz) to authenticated;
