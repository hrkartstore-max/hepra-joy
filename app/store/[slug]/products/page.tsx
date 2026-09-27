import Link from "next/link";
import AnalyticsTracker from "@/components/analytics-tracker";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const { q = "" } = await searchParams;
  const query = q.trim();
  const s = await createSupabaseServerClient();
  const { data: store } = await s.from("stores").select("id,name").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) notFound();

  let productsQuery = s.from("products").select("id,name,slug,price,compare_at_price,brand,stock").eq("store_id", store.id).eq("status", "active");
  if (query) productsQuery = productsQuery.ilike("name", "%" + query + "%");
  const { data: products } = await productsQuery.order("created_at", { ascending: false });

  return <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    {query ? <AnalyticsTracker storeSlug={slug} eventType="search" query={query} /> : null}
    <div>
      <p className="text-sm text-slate-500">{store.name}</p>
      <h1 className="mt-1 text-3xl font-bold">All products</h1>
      <p className="mt-2 text-sm text-slate-500">{products?.length ?? 0} published products</p>
    </div>
    <form className="mt-6 flex gap-2" action={"/store/" + slug + "/products"}>
      <input name="q" defaultValue={query} placeholder="Search products" className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3" />
      <button className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Search</button>
    </form>
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {(products ?? []).map(p => <Link key={p.id} href={"/store/" + slug + "/products/" + p.slug} className="group rounded-2xl border border-slate-200 p-4">
        <div className="aspect-square rounded-xl bg-slate-100" />
        <p className="mt-4 text-sm text-slate-500">{p.brand || "Product"}</p>
        <h2 className="mt-1 line-clamp-2 font-semibold">{p.name}</h2>
        <p className="mt-2 font-semibold">₹{Number(p.price).toLocaleString("en-IN")}</p>
      </Link>)}
    </div>
  </section>;
}
