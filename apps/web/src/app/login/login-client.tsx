"use client";

import React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  apiFetch,
  buildCloudflareAccessBootstrapUrl,
  buildCloudflareAccessBootstrapRetryUrl,
  clearCloudflareLoggedOutFlag,
  hasCloudflareLoggedOutFlag,
  hasCloudflareBootstrapMarker,
  hasCloudflareBootstrapRetryMarker,
  hasLoggedOutMarker,
  requestMagicLink,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2, Waves, ShieldCheck, ArrowRight } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "No login token provided.",
  invalid_token: "This login link is invalid.",
  token_used: "This login link has already been used. Request a new one.",
  token_expired: "This login link has expired. Request a new one.",
  user_inactive: "Your account is inactive. Contact your administrator.",
  cloudflare_access_missing:
    "This request did not arrive with Cloudflare Access identity. Try the main Data Pond entry again so Cloudflare can authenticate you first.",
  cloudflare_access_api_unreachable:
    "Cloudflare Access worked, but Data Pond could not reach the API session bootstrap path. Try again in a moment.",
  cloudflare_access_no_session:
    "Cloudflare Access worked, but no Data Pond session cookie was issued. Try again or use Magic Link below.",
  cloudflare_access_unavailable:
    "Cloudflare Access worked, but we could not establish your Data Pond session yet. Try again or use Magic Link below.",
};

export default function LoginClient() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const bootstrapAttempted = hasCloudflareBootstrapMarker(searchParams.toString());
  const bootstrapRetried = hasCloudflareBootstrapRetryMarker(searchParams.toString());
  const loggedOut = hasLoggedOutMarker(searchParams.toString());
  const cloudflareLoggedOut = hasCloudflareLoggedOutFlag();

  const [mode, setMode] = React.useState<"magic" | "password">("magic");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(
    errorParam
      ? ERROR_MESSAGES[errorParam] ?? "Login failed."
      : loggedOut || cloudflareLoggedOut
        ? "You have signed out of Data Pond."
      : bootstrapAttempted
        ? ERROR_MESSAGES.cloudflare_access_no_session
        : "",
  );
  const [loading, setLoading] = React.useState(false);
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);
  const [checkingExistingSession, setCheckingExistingSession] = React.useState(true);

  React.useEffect(() => {
    if (loggedOut || cloudflareLoggedOut) {
      setCheckingExistingSession(false);
      return;
    }

    let cancelled = false;

    async function checkSession() {
      const maxAttempts = bootstrapAttempted ? 3 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const res = await apiFetch("/v1/auth/me");
          if (res.ok && !cancelled) {
            const data = await res.json().catch(() => null);
            if (data?.user) {
              clearCloudflareLoggedOutFlag();
              window.location.href = "/";
              return;
            }
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
            continue;
          }

          if (!errorParam && !bootstrapAttempted && !loggedOut && !cancelled) {
            window.location.href = buildCloudflareAccessBootstrapUrl("/pond");
            return;
          }

          if (!errorParam && bootstrapAttempted && !bootstrapRetried && !loggedOut && !cancelled) {
            window.location.href = buildCloudflareAccessBootstrapRetryUrl("/");
            return;
          }
          break;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
            continue;
          }

          if (!errorParam && !bootstrapAttempted && !loggedOut && !cancelled) {
            window.location.href = buildCloudflareAccessBootstrapUrl("/pond");
            return;
          }

          if (!errorParam && bootstrapAttempted && !bootstrapRetried && !loggedOut && !cancelled) {
            window.location.href = buildCloudflareAccessBootstrapRetryUrl("/");
            return;
          }
          break;
        }
      }

      if (!cancelled) {
        setCheckingExistingSession(false);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [bootstrapAttempted, bootstrapRetried, cloudflareLoggedOut, errorParam, loggedOut]);

  function continueWithCloudflareAccess() {
    clearCloudflareLoggedOutFlag();
    window.location.href = buildCloudflareAccessBootstrapUrl("/pond");
  }

  const showCloudflareFrontDoor = loggedOut || cloudflareLoggedOut;

  if (checkingExistingSession) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #15284B 0%, #0D5E6D 50%, #15803D 100%)" }}
        />
        <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-sm text-white/75 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your access...
        </div>
      </div>
    );
  }

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
        clearCloudflareLoggedOutFlag();
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
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #15284B 0%, #0D5E6D 50%, #15803D 100%)" }}
      />

      <div className="absolute inset-x-0 bottom-0 h-[50%] pointer-events-none">
        <Image src="/pond-scene.svg" alt="" fill className="object-cover object-bottom opacity-40" priority />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-64 h-64 rounded-full bg-white/[0.03] animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute top-[60%] right-[5%] w-96 h-96 rounded-full bg-white/[0.02] animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute bottom-[10%] left-[30%] w-80 h-80 rounded-full bg-[#0D5E6D]/20 animate-pulse" style={{ animationDuration: "5s" }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/10">
            <Image src="/velo.svg" alt="Venterra" width={32} height={18} />
          </div>
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cloudflare One Protected
          </div>
          <div className="mb-2 flex items-center justify-center gap-2">
            <Waves className="h-5 w-5 text-[#0D5E6D]/60" style={{ color: "rgba(255,255,255,0.5)" }} />
            <h1 className="text-3xl font-bold tracking-tight text-white">The Data Pond</h1>
          </div>
          <p className="text-sm text-white/50">MarketingOps Analytics</p>
          <p className="mt-2 text-xs text-white/35">
            Styled like Data Pond. Secured at the edge by Cloudflare Access.
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          {magicLinkSent ? (
            <div className="py-2 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Check your email</h2>
              <p className="mt-3 text-sm text-white/60">We sent a sign-in link to</p>
              <p className="text-sm font-medium text-white/90">{email}</p>
              <p className="mt-3 text-xs text-white/40">The link expires in 15 minutes.</p>
              <button
                onClick={() => {
                  clearCloudflareLoggedOutFlag();
                  setMagicLinkSent(false);
                  setEmail("");
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </div>
          ) : mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="space-y-5">
              {showCloudflareFrontDoor && (
                <div className="rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-white/12 to-white/5 p-5 shadow-lg shadow-black/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Cloudflare One</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">Continue through Zero Trust</h2>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        Re-enter through Cloudflare Access first, then Data Pond will restore your app session securely.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={continueWithCloudflareAccess}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-cyan-950/40"
                  >
                    Continue with Cloudflare Access
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-white/70">
                  Email address
                </label>
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
                <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0D5E6D] to-[#15803D] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0D5E6D]/30 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-[#0D5E6D]/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {showCloudflareFrontDoor ? "Use Magic Link Instead" : "Send Magic Link"}
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-transparent px-3 text-xs text-white/30">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setError("");
                }}
                className="flex w-full items-center justify-center gap-2 text-xs text-white/40 transition-colors hover:text-white/70"
              >
                <KeyRound className="h-3 w-3" />
                Sign in with password instead
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              {showCloudflareFrontDoor && (
                <div className="rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-white/12 to-white/5 p-5 shadow-lg shadow-black/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Cloudflare One</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">Continue through Zero Trust</h2>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        Use Cloudflare Access for the normal sign-in path, or fall back to the app login below when needed.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={continueWithCloudflareAccess}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-cyan-950/40"
                  >
                    Continue with Cloudflare Access
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email-pw" className="block text-sm font-medium text-white/70">
                  Email address
                </label>
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
                <label htmlFor="password" className="block text-sm font-medium text-white/70">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/30 focus:border-[#0D5E6D] focus:ring-[#0D5E6D]/50"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0D5E6D] to-[#15803D] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0D5E6D]/30 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-[#0D5E6D]/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {showCloudflareFrontDoor ? "Use App Password Instead" : "Sign In"}
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-transparent px-3 text-xs text-white/30">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode("magic");
                  setError("");
                }}
                className="flex w-full items-center justify-center gap-2 text-xs text-white/40 transition-colors hover:text-white/70"
              >
                <Mail className="h-3 w-3" />
                Send a magic link instead
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-white/30">
          <p>MarketingOps · Internal Use Only</p>
        </div>
      </div>
    </div>
  );
}
