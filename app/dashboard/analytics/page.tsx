import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAnalyticsSummary } from "@/lib/analytics";

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stores } = await supabase
    .from("stores")
    .select("id,name,slug")
    .order("created_at", { ascending: false });

  const store = stores?.[0];
  if (!store) {
    return <section className="p-5 sm:p-8"><h1 className="text-3xl font-bold">Analytics</h1><p className="mt-3 text-slate-400">Create a store to view analytics.</p></section>;
  }

  const summary = await getAnalyticsSummary(store.id, 30);
  const cards = [
    ["Revenue", `₹${summary.revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`],
    ["Orders", String(summary.orders)],
    ["Conversion", `${summary.conversion_rate.toFixed(2)}%`],
    ["AOV", `₹${summary.aov.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`],
  ];

  return <section className="p-5 sm:p-8">
    <header>
      <p className="text-sm text-cyan-300">{store.name}</p>
      <h1 className="mt-1 text-3xl font-bold">Analytics</h1>
      <p className="mt-2 text-sm text-slate-400">Last 30 days · storefront funnel and sales performance</p>
    </header>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></article>)}
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Funnel</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(summary.funnel).map(([label, value]) => <div key={label} className="rounded-xl bg-black/20 p-3"><p className="text-xs uppercase text-slate-500">{label.replaceAll("_", " ")}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Top products</h2>
        <div className="mt-4 space-y-2">{summary.top_products.map((product) => <div key={product.name} className="flex justify-between rounded-xl bg-black/20 p-3 text-sm"><span>{product.name} · {product.units} units</span><span>₹{Number(product.revenue).toLocaleString("en-IN")}</span></div>)}</div>
      </section>
    </div>
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-semibold">Top categories</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{summary.top_categories.map((category) => <div key={category.name} className="flex justify-between rounded-xl bg-black/20 p-3 text-sm"><span>{category.name} · {category.units} units</span><span>₹{Number(category.revenue).toLocaleString("en-IN")}</span></div>)}</div>
    </section>
  </section>;
}
