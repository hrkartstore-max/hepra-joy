-- Phase 9: guest/authenticated carts, server-side pricing, transactional checkout and order creation.
alter table public.store_settings add column if not exists checkout_config jsonb not null default '{}'::jsonb;

create table if not exists public.order_counters (
  store_id uuid not null references public.stores(id) on delete cascade,
  order_date date not null,
  last_number integer not null default 0,
  primary key(store_id,order_date)
);
alter table public.order_counters enable row level security;
create policy "order_counters_admin" on public.order_counters for select using (public.is_store_admin(store_id));

create or replace function public.cart_add_item(
  p_store_id uuid,p_session_key text,p_product_id uuid,p_variant_id uuid,p_quantity integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_cart uuid; v_item uuid; v_price numeric; v_stock integer; v_user uuid:=auth.uid(); v_qty integer;
begin
 if p_quantity < 1 or p_quantity > 99 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from stores where id=p_store_id and status='active') then raise exception 'STORE_NOT_ACTIVE'; end if;
 if p_variant_id is not null then
   select price,stock into v_price,v_stock from variants where id=p_variant_id and product_id=p_product_id and store_id=p_store_id;
 else
   select price,stock into v_price,v_stock from products where id=p_product_id and store_id=p_store_id and status='active';
 end if;
 if v_price is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
 if v_stock < p_quantity then raise exception 'OUT_OF_STOCK'; end if;
 select id into v_cart from carts where store_id=p_store_id and status='active'
   and ((v_user is not null and customer_id in (select id from customers where user_id=v_user and store_id=p_store_id))
        or (v_user is null and session_key=p_session_key)) order by updated_at desc limit 1;
 if v_cart is null then
   insert into carts(store_id,customer_id,session_key) values(
     p_store_id,
     (select id from customers where store_id=p_store_id and user_id=v_user limit 1),
     case when v_user is null then p_session_key else null end
   ) returning id into v_cart;
 end if;
 select id into v_item from cart_items where cart_id=v_cart and product_id=p_product_id
   and coalesce(variant_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_variant_id,'00000000-0000-0000-0000-000000000000') limit 1;
 if v_item is null then
   insert into cart_items(store_id,cart_id,product_id,variant_id,quantity,unit_price)
   values(p_store_id,v_cart,p_product_id,p_variant_id,p_quantity,v_price) returning id into v_item;
 else
   update cart_items set quantity=quantity+p_quantity,unit_price=v_price where id=v_item;
   if (select quantity from cart_items where id=v_item)>v_stock then raise exception 'OUT_OF_STOCK'; end if;
 end if;
 update carts set updated_at=now() where id=v_cart;
 return jsonb_build_object('cart_id',v_cart,'item_id',v_item);
end;$$;

create or replace function public.cart_get(
 p_store_id uuid,p_session_key text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_cart uuid;v_items jsonb;v_subtotal numeric:=0;
begin
 select id into v_cart from carts where store_id=p_store_id and status='active'
 and ((v_user is not null and customer_id in(select id from customers where store_id=p_store_id and user_id=v_user))
 or (v_user is null and session_key=p_session_key)) order by updated_at desc limit 1;
 if v_cart is null then return jsonb_build_object('cart_id',null,'items','[]'::jsonb,'subtotal',0); end if;
 select coalesce(sum(quantity*unit_price),0) into v_subtotal from cart_items where cart_id=v_cart;
 select coalesce(jsonb_agg(jsonb_build_object('id',ci.id,'product_id',ci.product_id,'variant_id',ci.variant_id,'quantity',ci.quantity,'unit_price',ci.unit_price,'product_name',p.name,'variant_title',v.title)), '[]'::jsonb)
 into v_items from cart_items ci join products p on p.id=ci.product_id left join variants v on v.id=ci.variant_id where ci.cart_id=v_cart;
 return jsonb_build_object('cart_id',v_cart,'items',v_items,'subtotal',v_subtotal);
end;$$;

create or replace function public.cart_update_item(p_store_id uuid,p_session_key text,p_item_id uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_cart uuid;v_stock integer;v_variant uuid;v_product uuid;
begin
 select c.id into v_cart from carts c where c.store_id=p_store_id and c.status='active'
 and ((v_user is not null and c.customer_id in(select id from customers where store_id=p_store_id and user_id=v_user))
 or (v_user is null and c.session_key=p_session_key)) limit 1;
 select product_id,variant_id into v_product,v_variant from cart_items where id=p_item_id and cart_id=v_cart;
 if v_product is null then raise exception 'CART_ITEM_NOT_FOUND'; end if;
 if v_variant is not null then select stock into v_stock from variants where id=v_variant; else select stock into v_stock from products where id=v_product; end if;
 if p_quantity<=0 then delete from cart_items where id=p_item_id;
 elsif p_quantity>v_stock then raise exception 'OUT_OF_STOCK';
 else update cart_items set quantity=p_quantity where id=p_item_id; end if;
 update carts set updated_at=now() where id=v_cart;
 return public.cart_get(p_store_id,p_session_key);
end;$$;

create or replace function public.merge_guest_cart(p_store_id uuid,p_session_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_customer uuid;v_guest uuid;v_user_cart uuid;r record;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into customers(store_id,user_id,name,email) select p_store_id,v_user,coalesce(raw_user_meta_data->>'display_name',email),email from auth.users where id=v_user
 on conflict do nothing;
 select id into v_customer from customers where store_id=p_store_id and user_id=v_user limit 1;
 select id into v_guest from carts where store_id=p_store_id and session_key=p_session_key and status='active' limit 1;
 if v_guest is null then return public.cart_get(p_store_id,p_session_key); end if;
 select id into v_user_cart from carts where store_id=p_store_id and customer_id=v_customer and status='active' limit 1;
 if v_user_cart is null then update carts set customer_id=v_customer,session_key=null where id=v_guest;
 else
   for r in select product_id,variant_id,quantity,unit_price from cart_items where cart_id=v_guest loop
     insert into cart_items(store_id,cart_id,product_id,variant_id,quantity,unit_price) values(p_store_id,v_user_cart,r.product_id,r.variant_id,r.quantity,r.unit_price)
     on conflict do nothing;
   end loop;
   delete from carts where id=v_guest;
 end if;
 return public.cart_get(p_store_id,p_session_key);
end;$$;

create or replace function public.checkout_cart(
 p_store_id uuid,p_session_key text,p_name text,p_email text,p_phone text,p_shipping jsonb,p_discount_code text,p_payment_method text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_cart uuid;v_customer uuid;v_subtotal numeric:=0;v_discount numeric:=0;v_tax numeric:=0;v_shipping numeric:=0;v_total numeric:=0;v_discount_row record;r record;v_order uuid;v_order_no text;v_date date:=current_date;v_next integer;v_tax_rate numeric:=0;v_ship_flat numeric:=0;
begin
 if p_payment_method not in ('cod','online') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
 select id into v_cart from carts where store_id=p_store_id and status='active'
 and ((v_user is not null and customer_id in(select id from customers where store_id=p_store_id and user_id=v_user))
 or (v_user is null and session_key=p_session_key)) for update limit 1;
 if v_cart is null then raise exception 'CART_EMPTY'; end if;
 if exists(select 1 from cart_items ci where ci.cart_id=v_cart and (
   (ci.variant_id is not null and (select stock from variants where id=ci.variant_id)<ci.quantity) or
   (ci.variant_id is null and (select stock from products where id=ci.product_id)<ci.quantity))) then raise exception 'OUT_OF_STOCK'; end if;
 select coalesce(sum(quantity*unit_price),0) into v_subtotal from cart_items where cart_id=v_cart;
 select coalesce((checkout_config->>'tax_rate')::numeric,0),coalesce((checkout_config->>'shipping_flat')::numeric,0) into v_tax_rate,v_ship_flat from store_settings where store_id=p_store_id;
 v_shipping:=v_ship_flat;
 if nullif(trim(p_discount_code),'') is not null then
   select d.* into v_discount_row from discount_codes dc join discounts d on d.id=dc.discount_id where dc.store_id=p_store_id and upper(dc.code)=upper(trim(p_discount_code)) and d.active=true and (d.starts_at is null or d.starts_at<=now()) and (d.ends_at is null or d.ends_at>=now()) limit 1;
   if v_discount_row.id is null then raise exception 'INVALID_DISCOUNT'; end if;
   if v_subtotal < coalesce(v_discount_row.minimum_order,0) then raise exception 'DISCOUNT_MINIMUM_NOT_MET'; end if;
   if v_discount_row.type='percentage' then v_discount:=v_subtotal*v_discount_row.value/100; else v_discount:=least(v_subtotal,v_discount_row.value); end if;
   if v_discount_row.maximum_discount is not null then v_discount:=least(v_discount,v_discount_row.maximum_discount); end if;
 end if;
 v_tax:=greatest(v_subtotal-v_discount,0)*v_tax_rate/100;v_total:=greatest(v_subtotal-v_discount,0)+v_tax+v_shipping;
 if v_user is not null then
   insert into customers(store_id,user_id,name,email,phone) values(p_store_id,v_user,nullif(p_name,''),nullif(p_email,''),nullif(p_phone,''))
   on conflict do nothing;
   select id into v_customer from customers where store_id=p_store_id and user_id=v_user limit 1;
 else
   insert into customers(store_id,name,email,phone) values(p_store_id,nullif(p_name,''),nullif(p_email,''),nullif(p_phone,'')) returning id into v_customer;
 end if;
 insert into order_counters(store_id,order_date,last_number) values(p_store_id,v_date,0) on conflict do nothing;
 select last_number into v_next from order_counters where store_id=p_store_id and order_date=v_date for update;
 v_next:=v_next+1;update order_counters set last_number=v_next where store_id=p_store_id and order_date=v_date;
 v_order_no:='ZS-'||to_char(v_date,'YYYYMMDD')||'-'||lpad(v_next::text,6,'0');
 insert into orders(store_id,customer_id,order_number,payment_status,fulfillment_status,subtotal,discount_total,tax_total,shipping_total,total,currency,shipping_address,metadata)
 select p_store_id,v_customer,v_order_no,case when p_payment_method='cod' then 'pending' else 'pending' end,'unfulfilled',v_subtotal,v_discount,v_tax,v_shipping,v_total,coalesce(ss.currency,'INR'),p_shipping,jsonb_build_object('payment_method',p_payment_method) from store_settings ss where ss.store_id=p_store_id returning id into v_order;
 if v_order is null then raise exception 'STORE_SETTINGS_REQUIRED'; end if;
 for r in select ci.* ,p.name product_name,p.sku product_sku,v.title variant_title from cart_items ci join products p on p.id=ci.product_id left join variants v on v.id=ci.variant_id where ci.cart_id=v_cart loop
   if r.variant_id is not null then update variants set stock=stock-r.quantity,updated_at=now() where id=r.variant_id and stock>=r.quantity;
   else update products set stock=stock-r.quantity,updated_at=now() where id=r.product_id and stock>=r.quantity; end if;
   if not found then raise exception 'OUT_OF_STOCK'; end if;
   insert into order_items(store_id,order_id,product_id,variant_id,product_name,sku,quantity,unit_price) values(p_store_id,v_order,r.product_id,r.variant_id,r.product_name,coalesce(r.variant_title,r.product_sku),r.quantity,r.unit_price);
 end loop;
 insert into inventory_movements(store_id,inventory_id,quantity_delta,reason,reference_id)
 select p_store_id,i.id,-oi.quantity,'order_reservation',v_order from order_items oi join inventory i on i.product_id=oi.product_id and i.store_id=p_store_id where oi.order_id=v_order;
 update carts set status='converted',updated_at=now() where id=v_cart;
 if v_discount_row.id is not null then update discounts set usage_count=usage_count+1 where id=v_discount_row.id; end if;
 return jsonb_build_object('order_id',v_order,'order_number',v_order_no,'total',v_total,'payment_status','pending','payment_method',p_payment_method);
exception when others then raise;
end;$$;

revoke all on function public.cart_add_item(uuid,text,uuid,uuid,integer) from public;
revoke all on function public.cart_get(uuid,text) from public;
revoke all on function public.cart_update_item(uuid,text,uuid,integer) from public;
revoke all on function public.merge_guest_cart(uuid,text) from public;
revoke all on function public.checkout_cart(uuid,text,text,text,text,jsonb,text,text) from public;
grant execute on function public.cart_add_item(uuid,text,uuid,uuid,integer) to anon,authenticated;
grant execute on function public.cart_get(uuid,text) to anon,authenticated;
grant execute on function public.cart_update_item(uuid,text,uuid,integer) to anon,authenticated;
grant execute on function public.merge_guest_cart(uuid,text) to authenticated;
grant execute on function public.checkout_cart(uuid,text,text,text,text,jsonb,text,text) to anon,authenticated;