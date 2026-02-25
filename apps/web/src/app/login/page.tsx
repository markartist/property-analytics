"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { apiFetch, requestMagicLink } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#15284B]">
            <Image src="/velo.svg" alt="Venterra" width={28} height={16} />
          </div>
          <h1 className="text-2xl font-bold text-[#15284B]">The Data Pond</h1>
          <p className="mt-1 text-sm text-slate-500">Venterra WebOps Analytics</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Magic link sent confirmation */}
            {magicLinkSent ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Check your email</h2>
                <p className="mt-2 text-sm text-slate-500">
                  We sent a sign-in link to <span className="font-medium text-slate-700">{email}</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">The link expires in 15 minutes.</p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => { setMagicLinkSent(false); setEmail(""); }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to login
                </Button>
              </div>
            ) : mode === "magic" ? (
              /* Magic link form */
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@venterraliving.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full bg-[#15284B] hover:bg-[#1e3a6a]" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Magic Link
                </Button>

                <button
                  type="button"
                  onClick={() => { setMode("password"); setError(""); }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <KeyRound className="mr-1 inline h-3 w-3" />
                  Sign in with password instead
                </button>
              </form>
            ) : (
              /* Password form (fallback) */
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-pw">Email</Label>
                  <Input
                    id="email-pw"
                    type="email"
                    placeholder="you@venterraliving.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full bg-[#15284B] hover:bg-[#1e3a6a]" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign In
                </Button>

                <button
                  type="button"
                  onClick={() => { setMode("magic"); setError(""); }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Mail className="mr-1 inline h-3 w-3" />
                  Use magic link instead
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          Venterra WebOps &middot; Internal Use Only
        </p>
      </div>
    </div>
  );
}
