import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Store() {
  const s = await createSupabaseServerClient();
  const { data } = await s.from("stores").select("id,name,slug,status").order("created_at", { ascending: false });
  return <section className="p-5 sm:p-8"><h1 className="text-2xl font-bold">Store</h1><div className="mt-6 grid gap-4 md:grid-cols-2">{(data ?? []).map(x => <article key={x.id} className="rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">{x.name}</h2><p className="mt-2 text-sm text-slate-400">{x.slug}</p><p className="mt-4 text-sm">Status: {x.status}</p></article>)}</div></section>;
}
