"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { apiFetch, requestMagicLink } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2, Waves } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "No login token provided.",
  invalid_token: "This login link is invalid.",
  token_used: "This login link has already been used. Request a new one.",
  token_expired: "This login link has expired. Request a new one.",
  user_inactive: "Your account is inactive. Contact your administrator.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #15284B 0%, #0D5E6D 50%, #15803D 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [mode, setMode] = React.useState<"magic" | "password">("magic");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(errorParam ? ERROR_MESSAGES[errorParam] ?? "Login failed." : "");
  const [loading, setLoading] = React.useState(false);
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestMagicLink(email);
      setMagicLinkSent(true);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error?.message ?? "Login failed");
      }
    } catch {
      setError("Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Full-screen gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #15284B 0%, #0D5E6D 50%, #15803D 100%)" }}
      />

      {/* Pond scene at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-[50%] pointer-events-none">
        <Image
          src="/pond-scene.svg"
          alt=""
          fill
          className="object-cover object-bottom opacity-40"
          priority
        />
      </div>

      {/* Animated ripple circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-64 h-64 rounded-full bg-white/[0.03] animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute top-[60%] right-[5%] w-96 h-96 rounded-full bg-white/[0.02] animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute bottom-[10%] left-[30%] w-80 h-80 rounded-full bg-[#0D5E6D]/20 animate-pulse" style={{ animationDuration: "5s" }} />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Branding above card */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/10">
            <Image src="/velo.svg" alt="Venterra" width={32} height={18} />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Waves className="h-5 w-5 text-[#0D5E6D]/60" style={{ color: "rgba(255,255,255,0.5)" }} />
            <h1 className="text-3xl font-bold tracking-tight text-white">
              The Data Pond
            </h1>
          </div>
          <p className="text-sm text-white/50">
            Venterra WebOps Analytics
          </p>
        </div>

        {/* Glass-morphism card */}
        <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          {/* Magic link sent confirmation */}
          {magicLinkSent ? (
            <div className="text-center py-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Check your email</h2>
              <p className="mt-3 text-sm text-white/60">
                We sent a sign-in link to
              </p>
              <p className="text-sm font-medium text-white/90">{email}</p>
              <p className="mt-3 text-xs text-white/40">The link expires in 15 minutes.</p>
              <button
                onClick={() => { setMagicLinkSent(false); setEmail(""); }}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </div>
          ) : mode === "magic" ? (
            /* Magic link form */
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-white/70">Email address</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@venterraliving.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-12 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/30 focus:border-[#0D5E6D] focus:ring-[#0D5E6D]/50"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0D5E6D] to-[#15803D] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0D5E6D]/30 transition-all hover:shadow-xl hover:shadow-[#0D5E6D]/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Magic Link
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center"><span className="bg-transparent px-3 text-xs text-white/30">or</span></div>
              </div>

              <button
                type="button"
                onClick={() => { setMode("password"); setError(""); }}
                className="flex w-full items-center justify-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <KeyRound className="h-3 w-3" />
                Sign in with password instead
              </button>
            </form>
          ) : (
            /* Password form (fallback) */
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email-pw" className="block text-sm font-medium text-white/70">Email address</label>
                <Input
                  id="email-pw"
                  type="email"
                  placeholder="you@venterraliving.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-12 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/30 focus:border-[#0D5E6D] focus:ring-[#0D5E6D]/50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-white/70">Password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/30 focus:border-[#0D5E6D] focus:ring-[#0D5E6D]/50"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15284B] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-all hover:bg-[#1e3a6a] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center"><span className="bg-transparent px-3 text-xs text-white/30">or</span></div>
              </div>

              <button
                type="button"
                onClick={() => { setMode("magic"); setError(""); }}
                className="flex w-full items-center justify-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Mail className="h-3 w-3" />
                Use magic link instead
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <Image src="/velo.svg" alt="" width={12} height={7} className="opacity-30" />
          <p className="text-xs text-white/30">
            Venterra WebOps &middot; Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
