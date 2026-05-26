"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, LogIn, Waves } from "lucide-react";
import { clearCloudflareLoggedOutFlag } from "@/lib/api";

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #15284B 0%, #0D5E6D 50%, #15803D 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(!token ? "No login token provided." : "");

  async function handleVerify() {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      clearCloudflareLoggedOutFlag();
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
      window.location.href = `${apiBase}/v1/auth/verify?token=${encodeURIComponent(token)}&complete=1`;
    } catch {
      setError("Unable to connect to the server.");
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

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/10">
            <Image src="/velo.svg" alt="Venterra" width={32} height={18} />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Waves className="h-5 w-5" style={{ color: "rgba(255,255,255,0.5)" }} />
            <h1 className="text-3xl font-bold tracking-tight text-white">
              The Data Pond
            </h1>
          </div>
          <p className="text-sm text-white/50">
            MarketingOps Analytics
          </p>
        </div>

        {/* Glass-morphism card */}
        <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl text-center">
          {error ? (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-200 mb-6">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
              >
                Back to login
              </a>
            </>
          ) : (
            <>
              <p className="text-white/70 text-sm mb-6">
                Click below to complete your sign in.
              </p>
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0D5E6D] to-[#15803D] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0D5E6D]/30 transition-all hover:shadow-xl hover:shadow-[#0D5E6D]/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Complete Sign In
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <Image src="/velo.svg" alt="" width={12} height={7} className="opacity-30" />
          <p className="text-xs text-white/30">
            MarketingOps &middot; Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
