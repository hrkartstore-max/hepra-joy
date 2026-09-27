export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium text-cyan-300">HEPRA JOY</p>
        <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Stores", "Orders", "Revenue"].map((item) => (
            <article key={item} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-400">{item}</p>
              <p className="mt-3 text-3xl font-semibold">—</p>
              <p className="mt-2 text-xs text-slate-500">Awaiting connected Supabase data</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
