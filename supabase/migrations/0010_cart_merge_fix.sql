-- Phase 9 follow-up: enforce one customer identity per store and make guest-cart merge deterministic.
create unique index if not exists customers_store_user_unique on public.customers(store_id,user_id) where user_id is not null;
create or replace function public.merge_guest_cart(p_store_id uuid,p_session_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_customer uuid;v_guest uuid;v_user_cart uuid;r record;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into customers(store_id,user_id,name,email)
 select p_store_id,v_user,coalesce(raw_user_meta_data->>'display_name',email),email from auth.users where id=v_user
 on conflict (store_id,user_id) where user_id is not null do nothing;
 select id into v_customer from customers where store_id=p_store_id and user_id=v_user limit 1;
 select id into v_guest from carts where store_id=p_store_id and session_key=p_session_key and status='active' limit 1;
 if v_guest is null then return public.cart_get(p_store_id,p_session_key); end if;
 select id into v_user_cart from carts where store_id=p_store_id and customer_id=v_customer and status='active' limit 1;
 if v_user_cart is null then update carts set customer_id=v_customer,session_key=null where id=v_guest;
 else
   for r in select product_id,variant_id,quantity,unit_price from cart_items where cart_id=v_guest loop
     insert into cart_items(store_id,cart_id,product_id,variant_id,quantity,unit_price) values(p_store_id,v_user_cart,r.product_id,r.variant_id,r.quantity,r.unit_price);
   end loop;
   delete from carts where id=v_guest;
 end if;
 return public.cart_get(p_store_id,p_session_key);
end;$$;