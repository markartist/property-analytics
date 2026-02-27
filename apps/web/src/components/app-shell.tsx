"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/shared/sidebar";
import { Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/login"];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const isPublic = PUBLIC_PATHS.includes(pathname ?? "");

  // Public pages get no sidebar, no loading gate
  if (isPublic) return <>{children}</>;

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellInner>{children}</ShellInner>
    </AuthProvider>
  );
}
