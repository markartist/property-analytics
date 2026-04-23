"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { getRoleTitle, getSidebarOfferings, canAccessOffering, type SurfaceId } from "@/lib/permissions";
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
  Map,
  Bot,
  Compass,
} from "lucide-react";

const SURFACE_ICONS: Record<SurfaceId, React.ElementType> = {
  pond: Waves,
  watchtower: Eye,
  dock: Anchor,
  fish: Fish,
  tracker: Gauge,
  popBrief: FileText,
  pibBuilder: LineChart,
  searchIntelligence: Search,
  gbpPosts: MessageSquare,
  gscReport: Search,
  intelligenceOffice: BookOpenText,
  siteContent: FileSearch,
  vacs: Bot,
  evs: Compass,
  controlPlane: Map,
  backup: Download,
  adminUsers: Shield,
};

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const PRIMARY_DESTINATIONS = 5;
  const navItems = getSidebarOfferings(user?.role ?? "viewer").map((offering) => ({
    ...offering,
    icon: SURFACE_ICONS[offering.id],
    section: offering.category === "Primary" ? undefined : offering.category,
    accessible: canAccessOffering(user?.role ?? "viewer", offering.id),
  }));

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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "linear-gradient(180deg, #15284B 0%, #0D3B4F 40%, #0D5E6D 80%, #1A7A5A 100%)" }}
      >
        {/* Branding header */}
        <div className="px-5 py-4">
          <div className="flex min-h-[116px] flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-3">
              <Image src="/velo.svg" alt="Venterra" width={30} height={18} className="shrink-0" />
              <Image src="/venterra-text.svg" alt="Venterra" width={136} height={14} className="shrink-0" />
            </div>
            <span className="mt-3 block text-[42px] font-black leading-[0.92] tracking-[-0.06em] text-white">
              Data Pond
            </span>
            <span className="mt-3 block text-[11px] font-normal uppercase tracking-[0.34em] text-white/40">
              By MarketingOps
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navItems.map((item, idx) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/pond"
                  ? pathname === "/pond" || pathname === "/"
                : pathname?.startsWith(item.href);
            const showSection = item.section && (idx === 0 || navItems[idx - 1]?.section !== item.section);
            return (
              <React.Fragment key={item.href}>
                {idx === PRIMARY_DESTINATIONS && (
                  <div className="mx-2 my-4 border-t border-white/10" />
                )}
                {showSection && (
                  <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/36">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.accessible ? item.href : "#"}
                  onClick={(event) => {
                    if (!item.accessible) {
                      event.preventDefault();
                      return;
                    }
                    setMobileOpen(false);
                  }}
                  aria-disabled={!item.accessible}
                  className={cn(
                    idx < PRIMARY_DESTINATIONS
                      ? "mb-1.5 flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors"
                      : "mb-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    !item.accessible
                      ? "cursor-not-allowed text-white/28"
                      : isActive
                        ? "bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "text-white/70 hover:bg-white/8 hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      idx < PRIMARY_DESTINATIONS
                        ? "flex h-9 w-9 items-center justify-center rounded-xl bg-white/8"
                        : "flex h-8 w-8 items-center justify-center rounded-lg bg-transparent",
                      item.accessible && isActive && "bg-white/10",
                      !item.accessible && "bg-white/5"
                    )}
                  >
                    <item.icon className={idx < PRIMARY_DESTINATIONS ? "h-4.5 w-4.5" : "h-4 w-4"} />
                  </span>
                  <span className="flex items-center gap-2">
                    {item.label}
                    {!item.accessible && <span className="text-[10px] uppercase tracking-[0.18em] text-white/22">Locked</span>}
                  </span>
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
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{getRoleTitle(user.role)}</p>
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
              Produced by MarketingOps
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
