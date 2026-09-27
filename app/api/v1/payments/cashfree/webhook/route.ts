import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function valid(raw: string, sig: string, timestamp: string, secret: string) {
  const expected = createHmac("sha256", secret).update(timestamp + raw).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "CONFIGURATION_REQUIRED" }, { status: 503 });
  if (!sig || !timestamp || !valid(raw, sig, timestamp, secret)) return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const payment = (data.payment ?? {}) as Record<string, unknown>;
  const orderData = (data.order ?? {}) as Record<string, unknown>;
  const eventId = String(payment.cf_payment_id || "");
  const orderNumber = String(orderData.order_id || "");
  if (!eventId || !orderNumber) return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: order } = await admin.from("orders").select("id,store_id,total,currency").eq("order_number", orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });

  const eventType = String(payload.type || payload.event_type || "UNKNOWN");
  const { data: event, error: eventError } = await admin.from("payment_events").insert({
    store_id: order.store_id,
    provider: "cashfree",
    event_id: eventId,
    event_type: eventType,
    payload,
  }).select("id").maybeSingle();

  if (eventError?.code === "23505") return NextResponse.json({ ok: true, idempotent: true });
  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "EVENT_STORE_FAILED" }, { status: 500 });

  const lower = eventType.toLowerCase();
  const status = lower.includes("success") ? "paid" : lower.includes("failed") || lower.includes("dropped") ? "failed" : "pending";
  const { data: paymentRow, error: paymentError } = await admin.from("payments").insert({
    store_id: order.store_id,
    order_id: order.id,
    provider: "cashfree",
    provider_payment_id: eventId,
    status,
    amount: order.total,
    currency: order.currency,
    metadata: payload,
  }).select("id").maybeSingle();

  if (paymentError && paymentError.code !== "23505") return NextResponse.json({ error: paymentError.message }, { status: 500 });
  if (paymentRow?.id) await admin.from("payment_events").update({ payment_id: paymentRow.id, processed_at: new Date().toISOString() }).eq("id", event.id);
  if (status === "failed") await admin.rpc("release_order_stock", { p_order_id: order.id });
  if (status !== "pending") await admin.from("orders").update({ payment_status: status, updated_at: new Date().toISOString() }).eq("id", order.id);
  return NextResponse.json({ ok: true });
}
