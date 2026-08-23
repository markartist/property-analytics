"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  apiFetch,
  AUTH_PRIMARY,
  buildCloudflareAccessBootstrapUrl,
  buildCloudflareAccessBootstrapRetryUrl,
  buildCloudflareAccessLogoutUrl,
  clearCloudflareLoggedOutFlag,
  markCloudflareLoggedOut,
  hasCloudflareBootstrapMarker,
  hasCloudflareBootstrapRetryMarker,
  stripCloudflareBootstrapMarker,
} from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/login/verify", "/steps"];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (AUTH_PRIMARY === "magic" && pathname === "/") return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function buildMagicLinkLoginUrl(nextPath: string): string {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  return `/login?${params.toString()}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const pathname = usePathname();

  React.useEffect(() => {
    // Don't check auth on public paths
    if (isPublicPath(pathname)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const currentSearch = typeof window !== "undefined" ? window.location.search : "";
    const currentHash = typeof window !== "undefined" ? window.location.hash : "";
    const hasBootstrapMarker = hasCloudflareBootstrapMarker(currentSearch);
    const hasBootstrapRetryMarker = hasCloudflareBootstrapRetryMarker(currentSearch);

    async function checkSession() {
      const maxAttempts = hasBootstrapMarker ? 3 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const res = await apiFetch("/v1/auth/me");
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              clearCloudflareLoggedOutFlag();
              setUser(data.user);
              if (hasBootstrapMarker) {
                const cleanUrl = stripCloudflareBootstrapMarker(window.location.pathname, currentSearch, currentHash);
                window.history.replaceState({}, "", cleanUrl);
              }
            }
            return;
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
            continue;
          }

          if (!cancelled) {
            setUser(null);
            if (hasBootstrapMarker) {
              if (!hasBootstrapRetryMarker) {
                const retryPath = stripCloudflareBootstrapMarker(window.location.pathname, currentSearch, currentHash);
                window.location.href = buildCloudflareAccessBootstrapRetryUrl(retryPath);
                return;
              }
              window.location.href = "/login?error=cloudflare_access_no_session";
              return;
            }
            const nextPath = window.location.pathname + currentSearch + currentHash;
            if (AUTH_PRIMARY === "magic") {
              window.location.href = buildMagicLinkLoginUrl(nextPath);
              return;
            }
            window.location.href = buildCloudflareAccessBootstrapUrl(nextPath);
          }
          return;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
            continue;
          }

          if (!cancelled) {
            setUser(null);
            if (hasBootstrapMarker) {
              if (!hasBootstrapRetryMarker) {
                const retryPath = stripCloudflareBootstrapMarker(window.location.pathname, currentSearch, currentHash);
                window.location.href = buildCloudflareAccessBootstrapRetryUrl(retryPath);
                return;
              }
              window.location.href = "/login?error=cloudflare_access_api_unreachable";
              return;
            }
            const nextPath = window.location.pathname + currentSearch + currentHash;
            if (AUTH_PRIMARY === "magic") {
              window.location.href = buildMagicLinkLoginUrl(nextPath);
              return;
            }
            window.location.href = buildCloudflareAccessBootstrapUrl(nextPath);
          }
          return;
        }
      }
    }

    void checkSession().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const logout = React.useCallback(async () => {
    try {
      await apiFetch("/v1/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser(null);
    markCloudflareLoggedOut();
    if (AUTH_PRIMARY === "magic") {
      window.location.href = "/login?logged_out=1";
      return;
    }
    window.location.href = buildCloudflareAccessLogoutUrl();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
