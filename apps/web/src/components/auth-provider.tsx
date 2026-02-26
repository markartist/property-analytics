"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

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

const PUBLIC_PATHS = ["/login", "/login/verify"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const pathname = usePathname();

  React.useEffect(() => {
    // Don't check auth on public paths
    if (PUBLIC_PATHS.includes(pathname ?? "")) {
      setLoading(false);
      return;
    }

    apiFetch("/v1/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
          // Redirect to login
          window.location.href = "/login";
        }
      })
      .catch(() => {
        setUser(null);
        window.location.href = "/login";
      })
      .finally(() => setLoading(false));
  }, [pathname]);

  const logout = React.useCallback(async () => {
    try {
      await apiFetch("/v1/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
