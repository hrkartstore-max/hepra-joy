"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  async function googleLogin() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0D1117] px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">HEPRA JOY</p>
        <h1 className="mt-3 text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-slate-400">Sign in to manage your stores.</p>
        <form onSubmit={login} className="mt-8 space-y-4">
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300" type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <button onClick={googleLogin} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 font-semibold">Continue with Google</button>
        <p className="mt-6 text-center text-sm text-slate-400">New here? <a className="text-cyan-300" href="/auth/signup">Create an account</a></p>
      </div>
    </main>
  );
}
