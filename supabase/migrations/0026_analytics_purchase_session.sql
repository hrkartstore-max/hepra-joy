create or replace function public.record_order_purchase_analytics()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_session text;
begin
  if tg_op = 'UPDATE'
     and new.payment_status = 'paid'
     and old.payment_status is distinct from 'paid' then
    v_session := coalesce(new.metadata->>'analytics_session_id', 'server-' || new.id::text);
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
    where c.id = new.customer_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;
