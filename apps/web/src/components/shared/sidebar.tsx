"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Megaphone,
  BarChart2,
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
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; adminOnly?: boolean; section?: string }[] = [
  { href: "/", label: "The Pond", icon: Waves },
  { href: "/watchtower", label: "Watchtower", icon: Eye },
  { href: "/dock", label: "The Dock", icon: Anchor },
  { href: "/fish", label: "Fishing Hole", icon: Fish },

  // Reports
  { href: "/pib", label: "PIB Dashboard", icon: FileText, section: "Reports" },
  { href: "/analysis", label: "Analysis", icon: BarChart2 },
  { href: "/marketing", label: "Marketing Data", icon: Megaphone },
  { href: "/t7-metrics", label: "T7 Metrics", icon: Calendar },
  { href: "/t30-metrics", label: "T30 Metrics", icon: TrendingUp },

  // Utilities
  { href: "/backup", label: "Backup & Export", icon: Download, section: "Utilities" },
  { href: "/admin/users", label: "Admin", icon: Shield, adminOnly: true },
];

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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Branding header — corporate blue */}
        <div className="flex flex-col gap-2 bg-[#15284B] px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/velo.svg" alt="Venterra" width={28} height={16} className="shrink-0" />
            <Image src="/venterra-text.svg" alt="Venterra" width={100} height={10} className="shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-white">The Data Pond</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
              WebOps
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item, idx) => {
            if (item.adminOnly && user?.role !== "admin") return null;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            const showSection = item.section && (idx === 0 || NAV_ITEMS[idx - 1]?.section !== item.section);
            return (
              <React.Fragment key={item.href}>
                {showSection && (
                  <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#0D5E6D]/10 text-[#0D5E6D]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#0D5E6D]"
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
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-700">{user.email}</p>
                <p className="text-[10px] uppercase text-slate-400">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer branding */}
        <div className="border-t border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Image src="/velo-current.svg" alt="" width={14} height={8} className="shrink-0 text-slate-400" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Produced by Venterra WebOps
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
