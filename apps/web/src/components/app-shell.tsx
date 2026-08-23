"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/shared/sidebar";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { canAccessPath, IS_LAUNCH_ROOM_AUTH } from "@/lib/permissions";
import { Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/login", "/steps"];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (IS_LAUNCH_ROOM_AUTH && pathname === "/") return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user } = useAuth();
  const isPublic = isPublicPath(pathname);

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

  if (!canAccessPath(user?.role, pathname)) {
    const restrictedCard = IS_LAUNCH_ROOM_AUTH
      ? {
          title: "This launch room is the only available surface",
          description: "Company magic-link access is limited to the Resi Edge launch dashboard for readiness, blockers, evidence, and batch posture.",
          primaryHref: "/resi-edge/launch",
          primaryLabel: "Open Launch Dashboard",
          secondaryHref: "/login",
          secondaryLabel: "Switch account",
        }
      : {
          title: "This area is not available for Curators",
          description: "Your role can use The Pond home page and the POP Brief lane. The rest of the Data Pond navigation is visible for orientation, but those destinations stay locked.",
          primaryHref: "/pond",
          primaryLabel: "Open The Pond",
          secondaryHref: "/analysis",
          secondaryLabel: "Open POP Brief",
        };

    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <RestrictedSurfaceCard {...restrictedCard} />
        </main>
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
