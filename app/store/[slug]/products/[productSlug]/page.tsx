import Link from "next/link";
import AnalyticsTracker from "@/components/analytics-tracker";
import { addToCart } from "../../cart/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { buildStoreMetadata, getStoreBaseUrl } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const s = await createSupabaseServerClient();
  const { data: store } = await s.from("stores").select("id,name").eq("slug", slug).eq("status", "active").single();
  const { data: p } = await s.from("products").select("name,description,seo").eq("slug", productSlug).eq("status", "active").eq("store_id", store?.id || "").maybeSingle();
  if (!store || !p) return { title: "Product" };
  const seo = (p.seo ?? {}) as Record<string, unknown>;
  const baseUrl = await getStoreBaseUrl(store.id, slug);
  return buildStoreMetadata({
    baseUrl,
    path: "/products/" + productSlug,
    name: String(seo.title || p.name),
    description: String(seo.description || p.description || ""),
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const s = await createSupabaseServerClient();
  const { data: store } = await s.from("stores").select("id,name").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) notFound();

  const { data: p } = await s.from("products").select("id,name,description,price,compare_at_price,brand,stock,sku,video_url,seo").eq("store_id", store.id).eq("slug", productSlug).eq("status", "active").maybeSingle();
  if (!p) notFound();

  const [{ data: images }, { data: variants }] = await Promise.all([
    s.from("images").select("id,url,alt_text,position").eq("store_id", store.id).eq("product_id", p.id).order("position"),
    s.from("variants").select("id,title,sku,price,stock,options,image_url").eq("store_id", store.id).eq("product_id", p.id).order("created_at"),
  ]);

  const baseUrl = await getStoreBaseUrl(store.id, slug);
  const productUrl = baseUrl + "/products/" + productSlug;
  const productSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description || undefined,
    sku: p.sku || undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    image: (images ?? []).map(i => i.url),
    url: productUrl,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: Number(p.price),
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  }).replace(/</g, "\\u003c");
  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: store.name, item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Products", item: baseUrl + "/products" },
      { "@type": "ListItem", position: 3, name: p.name, item: productUrl },
    ],
  }).replace(/</g, "\\u003c");

  return <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    <AnalyticsTracker storeSlug={slug} eventType="product_view" productId={p.id} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productSchema }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    <Link href={"/store/" + slug + "/products"} className="text-sm text-slate-500">← Back to products</Link>
    <div className="mt-6 grid gap-10 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        {(images ?? []).length ? (images ?? []).map((i, index) => <img key={i.id} src={i.url} alt={i.alt_text || p.name} className={index === 0 ? "col-span-2 aspect-[4/3] w-full rounded-3xl object-cover" : "aspect-square w-full rounded-2xl object-cover"} />) : <div className="col-span-2 aspect-square rounded-3xl bg-slate-100" />}
      </div>
      <div>
        <p className="text-sm text-slate-500">{p.brand || store.name}</p>
        <h1 className="mt-2 text-3xl font-bold">{p.name}</h1>
        <div className="mt-5 flex items-center gap-3"><span className="text-2xl font-semibold">₹{Number(p.price).toLocaleString("en-IN")}</span>{p.compare_at_price ? <span className="text-slate-400 line-through">₹{Number(p.compare_at_price).toLocaleString("en-IN")}</span> : null}</div>
        <p className="mt-6 whitespace-pre-line text-slate-600">{p.description || "Product details will be available here."}</p>
        {(variants ?? []).length ? <div className="mt-8"><h2 className="font-semibold">Options</h2><div className="mt-3 grid gap-2">{(variants ?? []).map(v => <div key={v.id} className="rounded-xl border border-slate-200 p-3 text-sm">{v.title} · ₹{Number(v.price).toLocaleString("en-IN")} · {v.stock > 0 ? "Available" : "Out of stock"}</div>)}</div></div> : null}
        <form action={addToCart} className="mt-8 grid gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <input type="hidden" name="store_slug" value={slug} />
          <input type="hidden" name="product_id" value={p.id} />
          {(variants ?? []).length ? <select name="variant_id" required className="rounded-xl border border-slate-200 p-3"><option value="">Select an option</option>{(variants ?? []).map(v => <option key={v.id} value={v.id} disabled={v.stock <= 0}>{v.title} · ₹{Number(v.price).toLocaleString("en-IN")}{v.stock <= 0 ? " · Out of stock" : ""}</option>)}</select> : null}
          <input name="quantity" type="number" min="1" max={Math.max(1, p.stock)} defaultValue="1" className="rounded-xl border border-slate-200 p-3" />
          <button className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Add to cart</button>
        </form>
      </div>
    </div>
  </section>;
}
