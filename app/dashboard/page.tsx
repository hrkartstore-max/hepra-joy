import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stores } = await supabase
    .from("stores")
    .select("id,name,slug,status,organization_id")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cyan-300">HEPRA JOY</p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">{user.email}</p>
          </div>
          <form action={signOut}><button className="rounded-xl border border-white/10 px-4 py-2 text-sm">Sign out</button></form>
        </div>
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your stores</h2>
          <a href="/onboarding" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Create store</a>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {stores?.length ? stores.map((store) => (
            <article key={store.id} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-semibold">{store.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{store.slug}</p>
              <p className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs capitalize">{store.status}</p>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-slate-400">No stores yet. Create your first store to continue.</div>
          )}
        </div>
      </div>
    </main>
  );
}
