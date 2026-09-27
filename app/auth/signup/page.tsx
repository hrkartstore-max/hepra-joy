"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) {
      setError(error.message);
    } else if (!data.session) {
      setMessage("Account created. Check your email to verify your address, then sign in.");
    } else {
      window.location.href = "/onboarding";
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0D1117] px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">HEPRA JOY</p>
        <h1 className="mt-3 text-3xl font-bold">Create your account</h1>
        <form onSubmit={signup} className="mt-8 space-y-4">
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3" required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3" type="password" minLength={8} required placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          {message && <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">{message}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{loading ? "Creating…" : "Create account"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">Already have an account? <a className="text-cyan-300" href="/auth/login">Sign in</a></p>
      </div>
    </main>
  );
}
