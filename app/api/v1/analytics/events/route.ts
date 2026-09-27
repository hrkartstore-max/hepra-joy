import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  store_slug: z.string().trim().min(1).max(120),
  session_id: z.string().trim().min(8).max(100).optional(),
  event_type: z.enum(["page_view", "product_view", "search", "add_to_cart", "checkout"]),
  product_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  search_query: z.string().trim().max(200).optional(),
  path: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });

    const body = eventSchema.parse(await request.json());
    const cookieStore = await cookies();
    let sessionId = cookieStore.get("hepra_cart_session")?.value;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      cookieStore.set("hepra_cart_session", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", body.store_slug)
      .eq("status", "active")
      .maybeSingle();

    if (!store) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });

    const { error } = await supabase.from("analytics_events").insert({
      store_id: store.id,
      session_id: sessionId,
      user_id: user?.id ?? null,
      event_type: body.event_type,
      product_id: body.product_id ?? null,
      variant_id: body.variant_id ?? null,
      search_query: body.search_query ?? null,
      path: body.path ?? null,
    });

    if (error) return NextResponse.json({ error: "EVENT_NOT_RECORDED" }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
}
