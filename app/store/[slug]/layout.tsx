import Link from "next/link";
import { notFound } from "next/navigation";
import AnalyticsTracker from "@/components/analytics-tracker";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await createSupabaseServerClient();
  const { data: store } = await s.from("stores").select("id,name,slug,status").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) notFound();

  const [{ data: settings }, { data: menu }] = await Promise.all([
    s.from("store_settings").select("business_name,logo_url,currency,branding,seo").eq("store_id", store.id).maybeSingle(),
    s.from("navigation_menus").select("id,name,location").eq("store_id", store.id).eq("location", "header").maybeSingle(),
  ]);
  const [{ data: items }, { data: selection }] = await Promise.all([
    menu ? s.from("navigation_items").select("id,label,href,position").eq("menu_id", menu.id).eq("visible", true).order("position") : Promise.resolve({ data: [] as { id: string; label: string; href: string | null; position: number }[] }),
    s.from("store_themes").select("theme_id,theme_version_id,config").eq("store_id", store.id).eq("status", "published").maybeSingle(),
  ]);

  let themeConfig: Record<string, unknown> = { accent: "#111827", radius: "2xl", header: { style: "standard" } };
  if (selection?.theme_id) {
    const { data: theme } = await s.from("themes").select("slug").eq("id", selection.theme_id).maybeSingle();
    const { data: version } = selection.theme_version_id ? await s.from("theme_versions").select("config").eq("id", selection.theme_version_id).maybeSingle() : { data: null };
    themeConfig = { ...themeConfig, ...(version?.config ?? {}), ...(selection.config ?? {}), theme_slug: theme?.slug };
  }

  const radius = themeConfig.radius === "md" ? "rounded-xl" : themeConfig.radius === "xl" ? "rounded-2xl" : "rounded-3xl";
  const accent = typeof themeConfig.accent === "string" ? themeConfig.accent : "#111827";
  const themeSlug = typeof themeConfig.theme_slug === "string" ? themeConfig.theme_slug : "default";

  return <div className="min-h-screen bg-white text-slate-900" style={{ "--store-accent": accent } as React.CSSProperties}>
    <AnalyticsTracker storeSlug={store.slug} eventType="page_view" />
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6">
        <Link href={"/store/" + store.slug} className="flex min-w-0 items-center gap-3">
          {settings?.logo_url ? <img src={settings.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : null}
          <span className="truncate text-lg font-bold">{settings?.business_name || store.name}</span>
        </Link>
        <nav className="hidden flex-1 items-center gap-5 md:flex">
          {(items ?? []).map(i => <Link key={i.id} href={i.href || "#"} className="text-sm text-slate-600 hover:text-slate-950">{i.label}</Link>)}
          <Link href={"/store/" + store.slug + "/products"} className="text-sm text-slate-600 hover:text-slate-950">All products</Link>
        </nav>
        <Link href={"/store/" + store.slug + "/products"} className={radius + " ml-auto px-4 py-2 text-sm font-semibold text-white"} style={{ backgroundColor: "var(--store-accent)" }}>Shop</Link>
      </div>
    </header>
    <main>{children}</main>
    <footer className="mt-20 border-t border-slate-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 text-sm text-slate-500 sm:flex-row sm:justify-between">
        <span>{settings?.business_name || store.name}</span>
        <span>Powered by HEPRA JOY · {themeSlug}</span>
      </div>
    </footer>
  </div>;
}
