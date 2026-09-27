-- Phase 10: payment failure releases the inventory reserved by Phase 9 checkout.
create or replace function public.release_order_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
 for r in select product_id,variant_id,quantity from order_items where order_id=p_order_id loop
   if r.variant_id is not null then update variants set stock=stock+r.quantity,updated_at=now() where id=r.variant_id;
   elsif r.product_id is not null then update products set stock=stock+r.quantity,updated_at=now() where id=r.product_id; end if;
 end loop;
end;$$;
revoke all on function public.release_order_stock(uuid) from public;
