"use client";

import type { ComponentType } from "react";
import {
  BarChart2,
  Building,
  Calendar as CalendarIcon,
  DollarSign,
  FileDown,
  NotebookText,
  TrendingUp,
  UserCircle2,
} from "lucide-react";

export type PopBriefNavItem = {
  href?: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export const POP_BRIEF_NAV_ITEMS: PopBriefNavItem[] = [
  { href: "/communities", label: "Communities", description: "Manage properties and import-facing names.", icon: Building },
  { href: "/t7-metrics", label: "T7 Metrics", description: "Weekly leasing funnel updates and imports.", icon: CalendarIcon },
  { href: "/t30-metrics", label: "T30 Metrics", description: "Monthly leasing funnel updates and imports.", icon: TrendingUp },
  { href: "/marketing", label: "Marketing Data", description: "Website & SEO CSV import plus weekly marketing workflow.", icon: DollarSign },
  { href: "/analysis", label: "Analysis", description: "Main POP Brief performance view.", icon: BarChart2 },
  { label: "Call Notes", description: "Reserved navigation slot from Base44; route not mounted yet.", icon: NotebookText },
  { href: "/backup", label: "Backup & Export", description: "Download CSV backups and create server artifacts.", icon: FileDown },
  { label: "Profile", description: "Reserved navigation slot from Base44; route not mounted yet.", icon: UserCircle2 },
];
