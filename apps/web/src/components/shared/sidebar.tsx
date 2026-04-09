"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import {
  BarChart3,
  Search,
  Download,
  Shield,
  Menu,
  X,
  LogOut,
  FileText,
  Waves,
  Anchor,
  Eye,
  Fish,
  LineChart,
  MessageSquare,
  Gauge,
  BookOpenText,
  FileSearch,
} from "lucide-react";

type NavRole = "admin" | "editor" | "viewer";

const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; minRole?: NavRole; section?: string }[] = [
  { href: "/", label: "The Pond", icon: Waves },
  { href: "/watchtower", label: "Watchtower", icon: Eye },
  { href: "/dock", label: "The Dock", icon: Anchor },
  { href: "/fish", label: "Fishing Hole", icon: Fish },
  { href: "/tracker", label: "Pilot Tracker", icon: Gauge },

  // Reports
  { href: "/analysis", label: "POP Brief", icon: FileText, section: "Reports", minRole: "editor" },
  { href: "/analysis/pib", label: "PIB Builder", icon: LineChart, minRole: "editor" },
  { href: "/gbp-posts", label: "GBP Posts", icon: MessageSquare, minRole: "editor" },
  { href: "/gsc", label: "GSC Report", icon: Search, minRole: "editor" },
  { href: "/intelligence-office", label: "Intelligence Office", icon: BookOpenText, minRole: "admin" },
  { href: "/site-content", label: "Site Content Creator", icon: FileSearch, minRole: "admin" },

  // Utilities
  { href: "/backup", label: "Backup & Export", icon: Download, section: "Utilities", minRole: "editor" },
  { href: "/admin/users", label: "Admin", icon: Shield, minRole: "admin" },
];

/** Role hierarchy: admin > editor > viewer */
const ROLE_LEVEL: Record<NavRole, number> = { viewer: 0, editor: 1, admin: 2 };
function hasRole(userRole: NavRole | undefined, minRole: NavRole): boolean {
  if (!userRole) return false;
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 rounded-md bg-[#15284B] p-2 text-white lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "linear-gradient(180deg, #15284B 0%, #0D3B4F 40%, #0D5E6D 80%, #1A7A5A 100%)" }}
      >
        {/* Branding header */}
        <div className="flex flex-col gap-2 px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/velo.svg" alt="Venterra" width={28} height={16} className="shrink-0" />
            <Image src="/venterra-text.svg" alt="Venterra" width={100} height={10} className="shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-white">The Data Pond</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              WebOps
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item, idx) => {
            if (item.minRole && !hasRole(user?.role, item.minRole)) return null;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            const showSection = item.section && (idx === 0 || NAV_ITEMS[idx - 1]?.section !== item.section);
            return (
              <React.Fragment key={item.href}>
                {showSection && (
                  <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>

        {/* User + Logout */}
        {user && (
          <div className="border-t border-white/15 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/90">{user.email}</p>
                <p className="text-[10px] uppercase text-white/40">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer branding */}
        <div className="border-t border-white/15 px-5 py-3">
          <div className="flex items-center gap-2">
            <Image src="/velo-current.svg" alt="" width={14} height={8} className="shrink-0 opacity-50" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Produced by Venterra WebOps
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
