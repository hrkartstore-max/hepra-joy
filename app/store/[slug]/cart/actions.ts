"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cashfreeConfigured, cashfreeRequest } from "@/lib/payments/cashfree";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function session() {
  const c = await cookies();
  let v = c.get("hepra_cart_session")?.value;
  if (!v) {
    v = crypto.randomUUID();
    c.set("hepra_cart_session", v, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return v;
}

export async function addToCart(f: FormData) {
  const s = await createSupabaseServerClient();
  const analyticsSession = await session();
  const storeId = str(f.get("store_id"));
  const productId = str(f.get("product_id"));
  const variantId = str(f.get("variant_id")) || null;
  const quantity = Number(f.get("quantity") || 1);

  const r = await s.rpc("cart_add_item", {
    p_store_id: storeId,
    p_session_key: analyticsSession,
    p_product_id: productId,
    p_variant_id: variantId,
    p_quantity: quantity,
  });
  if (r.error) throw new Error(r.error.message);

  await s.from("analytics_events").insert({
    store_id: storeId,
    session_id: analyticsSession,
    event_type: "add_to_cart",
    product_id: productId,
    variant_id: variantId,
    value: null,
    metadata: { quantity },
  });

  redirect("/store/" + str(f.get("store_slug")) + "/cart");
}

export async function mergeCart(f: FormData) {
  const s = await createSupabaseServerClient();
  const r = await s.rpc("merge_guest_cart", {
    p_store_id: str(f.get("store_id")),
    p_session_key: await session(),
  });
  if (r.error) throw new Error(r.error.message);
}

export async function updateCartItem(f: FormData) {
  const s = await createSupabaseServerClient();
  const r = await s.rpc("cart_update_item", {
    p_store_id: str(f.get("store_id")),
    p_session_key: await session(),
    p_item_id: str(f.get("item_id")),
    p_quantity: Number(f.get("quantity") || 0),
  });
  if (r.error) throw new Error(r.error.message);
  redirect("/store/" + str(f.get("store_slug")) + "/cart");
}

export async function checkout(f: FormData) {
  const s = await createSupabaseServerClient();
  const analyticsSession = await session();
  const storeId = str(f.get("store_id"));
  const storeSlug = str(f.get("store_slug"));
  const paymentMethod = str(f.get("payment_method") || "cod");

  const r = await s.rpc("checkout_cart", {
    p_store_id: storeId,
    p_session_key: analyticsSession,
    p_name: str(f.get("name")),
    p_email: str(f.get("email")),
    p_phone: str(f.get("phone")),
    p_shipping: {
      line1: str(f.get("line1")),
      city: str(f.get("city")),
      state: str(f.get("state")),
      postal_code: str(f.get("postal_code")),
      country: "IN",
    },
    p_discount_code: str(f.get("discount_code")),
    p_payment_method: paymentMethod,
  });
  if (r.error) throw new Error(r.error.message);

  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,store_id,order_number,total,currency,customer_id,metadata")
    .eq("order_number", r.data.order_number)
    .maybeSingle();
  if (!order) throw new Error("ORDER_NOT_FOUND");

  await admin.from("orders").update({
    metadata: { ...(order.metadata ?? {}), analytics_session_id: analyticsSession },
  }).eq("id", order.id);

  await s.from("analytics_events").insert({
    store_id: storeId,
    session_id: analyticsSession,
    event_type: "checkout",
    order_id: order.id,
    value: order.total,
    currency: order.currency,
  });

  if (paymentMethod === "cod") {
    await s.from("analytics_events").insert({
      store_id: storeId,
      session_id: analyticsSession,
      event_type: "purchase",
      path: "/orders/" + order.order_number,
      order_id: order.id,
      value: order.total,
      currency: order.currency,
      metadata: { order_number: order.order_number, source: "cod" },
    });
    redirect("/store/" + storeSlug + "/orders/success?order=" + encodeURIComponent(r.data.order_number));
  }

  if (!cashfreeConfigured()) throw new Error("CONFIGURATION REQUIRED: Cashfree credentials are missing.");

  const { data: customer } = order.customer_id
    ? await admin.from("customers").select("name,email,phone").eq("id", order.customer_id).maybeSingle()
    : { data: null };
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("CONFIGURATION REQUIRED: NEXT_PUBLIC_SITE_URL is missing.");

  const cf = await cashfreeRequest("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": order.id },
    body: JSON.stringify({
      order_amount: Number(order.total),
      order_currency: order.currency,
      order_id: order.order_number,
      customer_details: {
        customer_id: order.customer_id || order.order_number,
        customer_name: customer?.name || "Customer",
        customer_email: customer?.email || "customer@example.com",
        customer_phone: customer?.phone || "9999999999",
      },
      order_meta: {
        return_url: site + "/store/" + storeSlug + "/checkout/result?order_id={order_id}",
        notify_url: site + "/api/v1/payments/cashfree/webhook",
      },
    }),
  });

  await admin.from("payments").insert({
    store_id: order.store_id,
    order_id: order.id,
    provider: "cashfree",
    provider_payment_id: order.order_number,
    status: "pending",
    amount: order.total,
    currency: order.currency,
    metadata: { payment_session_id: cf.payment_session_id },
  });

  redirect("/store/" + storeSlug + "/checkout/payment?order=" + encodeURIComponent(order.order_number));
}
