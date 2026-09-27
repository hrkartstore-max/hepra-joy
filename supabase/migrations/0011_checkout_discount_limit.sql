-- Phase 9 follow-up: enforce discount usage limits at checkout.
create or replace function public.checkout_cart(
 p_store_id uuid,p_session_key text,p_name text,p_email text,p_phone text,p_shipping jsonb,p_discount_code text,p_payment_method text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_cart uuid;v_customer uuid;v_subtotal numeric:=0;v_discount numeric:=0;v_tax numeric:=0;v_shipping numeric:=0;v_total numeric:=0;v_discount_row record;r record;v_order uuid;v_order_no text;v_date date:=current_date;v_next integer;v_tax_rate numeric:=0;v_ship_flat numeric:=0;
begin
 if p_payment_method not in ('cod','online') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
 select id into v_cart from carts where store_id=p_store_id and status='active' and ((v_user is not null and customer_id in(select id from customers where store_id=p_store_id and user_id=v_user)) or (v_user is null and session_key=p_session_key)) for update limit 1;
 if v_cart is null then raise exception 'CART_EMPTY'; end if;
 if exists(select 1 from cart_items ci where ci.cart_id=v_cart and ((ci.variant_id is not null and (select stock from variants where id=ci.variant_id)<ci.quantity) or (ci.variant_id is null and (select stock from products where id=ci.product_id)<ci.quantity))) then raise exception 'OUT_OF_STOCK'; end if;
 select coalesce(sum(quantity*unit_price),0) into v_subtotal from cart_items where cart_id=v_cart;
 select coalesce((checkout_config->>'tax_rate')::numeric,0),coalesce((checkout_config->>'shipping_flat')::numeric,0) into v_tax_rate,v_ship_flat from store_settings where store_id=p_store_id;
 v_shipping:=v_ship_flat;
 if nullif(trim(p_discount_code),'') is not null then
   select d.* into v_discount_row from discount_codes dc join discounts d on d.id=dc.discount_id where dc.store_id=p_store_id and upper(dc.code)=upper(trim(p_discount_code)) and d.active=true and (d.starts_at is null or d.starts_at<=now()) and (d.ends_at is null or d.ends_at>=now()) limit 1;
   if v_discount_row.id is null then raise exception 'INVALID_DISCOUNT'; end if;
   if v_discount_row.usage_limit is not null and v_discount_row.usage_count>=v_discount_row.usage_limit then raise exception 'DISCOUNT_USAGE_LIMIT_REACHED'; end if;
   if v_subtotal < coalesce(v_discount_row.minimum_order,0) then raise exception 'DISCOUNT_MINIMUM_NOT_MET'; end if;
   if v_discount_row.type='percentage' then v_discount:=v_subtotal*v_discount_row.value/100; elsif v_discount_row.type='fixed' then v_discount:=least(v_subtotal,v_discount_row.value); else v_discount:=0; end if;
   if v_discount_row.maximum_discount is not null then v_discount:=least(v_discount,v_discount_row.maximum_discount); end if;
 end if;
 v_tax:=greatest(v_subtotal-v_discount,0)*v_tax_rate/100;v_total:=greatest(v_subtotal-v_discount,0)+v_tax+v_shipping;
 if v_user is not null then
   insert into customers(store_id,user_id,name,email,phone) values(p_store_id,v_user,nullif(p_name,''),nullif(p_email,''),nullif(p_phone,'')) on conflict (store_id,user_id) where user_id is not null do update set name=excluded.name,email=excluded.email,phone=excluded.phone,updated_at=now();
   select id into v_customer from customers where store_id=p_store_id and user_id=v_user limit 1;
 else
   insert into customers(store_id,name,email,phone) values(p_store_id,nullif(p_name,''),nullif(p_email,''),nullif(p_phone,'')) returning id into v_customer;
 end if;
 insert into order_counters(store_id,order_date,last_number) values(p_store_id,v_date,0) on conflict do nothing;
 select last_number into v_next from order_counters where store_id=p_store_id and order_date=v_date for update;
 v_next:=v_next+1;update order_counters set last_number=v_next where store_id=p_store_id and order_date=v_date;
 v_order_no:='ZS-'||to_char(v_date,'YYYYMMDD')||'-'||lpad(v_next::text,6,'0');
 insert into orders(store_id,customer_id,order_number,payment_status,fulfillment_status,subtotal,discount_total,tax_total,shipping_total,total,currency,shipping_address,metadata)
 select p_store_id,v_customer,v_order_no,'pending','unfulfilled',v_subtotal,v_discount,v_tax,v_shipping,v_total,coalesce(ss.currency,'INR'),p_shipping,jsonb_build_object('payment_method',p_payment_method) from store_settings ss where ss.store_id=p_store_id returning id into v_order;
 if v_order is null then raise exception 'STORE_SETTINGS_REQUIRED'; end if;
 for r in select ci.*,p.name product_name,p.sku product_sku,v.title variant_title from cart_items ci join products p on p.id=ci.product_id left join variants v on v.id=ci.variant_id where ci.cart_id=v_cart loop
   if r.variant_id is not null then update variants set stock=stock-r.quantity,updated_at=now() where id=r.variant_id and stock>=r.quantity; else update products set stock=stock-r.quantity,updated_at=now() where id=r.product_id and stock>=r.quantity; end if;
   if not found then raise exception 'OUT_OF_STOCK'; end if;
   insert into order_items(store_id,order_id,product_id,variant_id,product_name,sku,quantity,unit_price) values(p_store_id,v_order,r.product_id,r.variant_id,r.product_name,coalesce(r.variant_title,r.product_sku),r.quantity,r.unit_price);
 end loop;
 update carts set status='converted',updated_at=now() where id=v_cart;
 if v_discount_row.id is not null then update discounts set usage_count=usage_count+1 where id=v_discount_row.id; end if;
 return jsonb_build_object('order_id',v_order,'order_number',v_order_no,'total',v_total,'payment_status','pending','payment_method',p_payment_method);
end;$$;