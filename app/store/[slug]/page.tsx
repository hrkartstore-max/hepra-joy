import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AnalyticsTracker from "@/components/analytics-tracker";
import { buildStoreMetadata, getStoreBaseUrl } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await createSupabaseServerClient();
  const { data: store } = await s.from("stores").select("id,name").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) return { title: "Store" };
  const { data: settings } = await s.from("store_settings").select("business_name,logo_url,seo").eq("store_id", store.id).maybeSingle();
  const seo = (settings?.seo ?? {}) as Record<string, unknown>;
  const baseUrl = await getStoreBaseUrl(store.id, slug);
  return buildStoreMetadata({
    baseUrl,
    name: String(seo.title || settings?.business_name || store.name),
    description: String(seo.description || "Shop " + store.name),
    image: settings?.logo_url,
  });
}

export default async function StoreHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await createSupabaseServerClient();
  const { data: store } = await s.from("stores").select("id,name,slug").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) notFound();

  const [{ data: settings }, { data: categories }, { data: products }, { data: page }, { data: selection }] = await Promise.all([
    s.from("store_settings").select("business_name,logo_url,branding,seo,phone,email,address").eq("store_id", store.id).maybeSingle(),
    s.from("categories").select("id,name,slug,image_url").eq("store_id", store.id).eq("visible", true).order("position").limit(8),
    s.from("products").select("id,name,slug,price,compare_at_price,brand").eq("store_id", store.id).eq("status", "active").order("created_at", { ascending: false }).limit(8),
    s.from("pages").select("id,title,status").eq("store_id", store.id).eq("slug", "home").eq("status", "published").maybeSingle(),
    s.from("store_themes").select("theme_id,config").eq("store_id", store.id).eq("status", "published").maybeSingle(),
  ]);

  let accent = "#111827";
  if (selection?.theme_id) {
    const { data: t } = await s.from("themes").select("slug").eq("id", selection.theme_id).maybeSingle();
    const slugAccent: Record<string, string> = {
      fashion: "#400378", "saree-ethnic": "#9F1239", "beauty-cosmetics": "#C0266B", jewellery: "#B08D2C",
      optical: "#071B49", electronics: "#2563EB", grocery: "#15803D", "restaurant-food": "#B45309",
      "home-lifestyle": "#92400E", "minimal-d2c": "#111827",
    };
    accent = typeof selection.config?.accent === "string" ? selection.config.accent : slugAccent[t?.slug || "minimal-d2c"] || accent;
  }

  const address = (settings?.address ?? {}) as Record<string, unknown>;
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings?.business_name || store.name,
    url: await getStoreBaseUrl(store.id, slug),
    logo: settings?.logo_url || undefined,
    email: settings?.email || undefined,
    telephone: settings?.phone || undefined,
  };
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings?.business_name || store.name,
    url: await getStoreBaseUrl(store.id, slug),
    image: settings?.logo_url || undefined,
    telephone: settings?.phone || undefined,
    email: settings?.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: String(address.line1 || ""),
      addressLocality: String(address.city || ""),
      addressRegion: String(address.state || ""),
      postalCode: String(address.postal_code || ""),
      addressCountry: String(address.country || "IN"),
    },
  };
  const jsonLd = JSON.stringify([organization, localBusiness]).replace(/</g, "\\u003c");

  return <div>
    <AnalyticsTracker storeSlug={slug} eventType="page_view" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    <section className="text-white" style={{ backgroundColor: accent }}><div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:py-28"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-white/70">Welcome</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">{settings?.business_name || store.name}</h1><p className="mt-5 max-w-xl text-lg text-white/75">Discover our latest products, collections and offers.</p><Link href={"/store/" + slug + "/products"} className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-slate-950">Explore products</Link></div><div className="rounded-3xl border border-white/20 bg-white/10 p-8"><p className="text-sm text-white/60">Storefront theme</p><p className="mt-3 text-2xl font-semibold">{selection?.theme_id ? "Selected theme" : "Default theme"}</p><p className="mt-3 text-white/60">{page ? "Published homepage" : "Your published store homepage"}</p></div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6"><h2 className="text-2xl font-bold">Shop by category</h2><div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">{(categories ?? []).map(c => <Link key={c.id} href={"/store/" + slug + "/categories/" + c.slug} className="rounded-2xl border border-slate-200 p-5 hover:border-slate-400">{c.image_url ? <img src={c.image_url} alt={c.name} className="aspect-square w-full rounded-xl object-cover" /> : null}<p className="mt-3 font-semibold">{c.name}</p></Link>)}</div></section>
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"><div className="flex items-end justify-between"><div><h2 className="text-2xl font-bold">Featured products</h2><p className="mt-1 text-sm text-slate-500">Recently published products</p></div><Link href={"/store/" + slug + "/products"} className="text-sm font-semibold">View all</Link></div><div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-4">{(products ?? []).map(p => <Link key={p.id} href={"/store/" + slug + "/products/" + p.slug} className="group rounded-2xl border border-slate-200 p-4"><div className="aspect-square rounded-xl bg-slate-100"/><p className="mt-4 text-sm text-slate-500">{p.brand || "Product"}</p><h3 className="mt-1 line-clamp-2 font-semibold">{p.name}</h3><div className="mt-2 flex items-center gap-2"><span className="font-semibold">₹{Number(p.price).toLocaleString("en-IN")}</span>{p.compare_at_price ? <span className="text-sm text-slate-400 line-through">₹{Number(p.compare_at_price).toLocaleString("en-IN")}</span> : null}</div></Link>)}</div></section>
  </div>;
}
