export default function Home() {
  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">HEPRA JOY</p>
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">
          Build. Launch. Grow.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          A production-ready multi-tenant platform for Indian businesses to create, manage and grow online stores.
        </p>
        <div className="mt-10 flex gap-4">
          <a className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950" href="/dashboard">
            Open dashboard
          </a>
        </div>
      </section>
    </main>
  );
}
