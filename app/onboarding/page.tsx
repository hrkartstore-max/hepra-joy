import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createOrganization } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <main className="min-h-screen bg-[#0D1117] px-6 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">HEPRA JOY</p>
        <h1 className="mt-3 text-4xl font-bold">Set up your first store</h1>
        <p className="mt-3 text-slate-400">Create your organization and store in one secure transaction.</p>
        <form action={createOrganization} className="mt-10 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8">
          <input name="organizationName" required className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3" placeholder="Business / organization name" />
          <input name="storeName" required className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3" placeholder="Store name" />
          <button className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">Create store</button>
        </form>
      </div>
    </main>
  );
}
