"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommunitySelector } from "@/components/shared/community-selector";
import { WeekDatePicker } from "@/components/shared/week-date-picker";
import { POP_BRIEF_NAV_ITEMS } from "@/lib/pop-brief-nav";
import type { Community } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface PopBriefPageHeaderProps {
  title: string;
  titleIcon: LucideIcon;
  subtitle: string;
  byline?: string;
  badge?: string;
  weekDate: Date | null;
  onWeekDateChange: (date: Date) => void;
  communityId: string;
  onCommunityIdChange: (value: string) => void;
  communities: Community[];
  communityPlaceholder?: string;
}

export function PopBriefPageHeader({
  title,
  titleIcon: TitleIcon,
  subtitle,
  byline,
  badge,
  weekDate,
  onWeekDateChange,
  communityId,
  onCommunityIdChange,
  communities,
  communityPlaceholder = "Select community",
}: PopBriefPageHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="sticky top-4 z-20 mb-8 rounded-[24px] border border-slate-200 bg-white/95 px-6 py-5 shadow-[0_16px_36px_rgba(21,40,75,0.08)] backdrop-blur print:static print:border-0 print:bg-transparent print:px-0 print:py-0 print:shadow-none">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {badge && (
            <div className="mb-3 inline-flex items-center rounded-full bg-[#15284B] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              {badge}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15284B] shadow-[0_10px_24px_rgba(21,40,75,0.16)]">
              <TitleIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#15284B]">{title}</h1>
          </div>
          <p className="mt-3 text-lg text-slate-700">{subtitle}</p>
          {byline ? <p className="mt-1 text-sm font-normal text-slate-400">{byline}</p> : null}
        </div>

        <div className="flex flex-col gap-3 print:hidden md:min-w-[420px] md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-3 md:flex-nowrap">
            <WeekDatePicker value={weekDate} onChange={onWeekDateChange} />
            <CommunitySelector
              value={communityId}
              onValueChange={onCommunityIdChange}
              placeholder={communityPlaceholder}
              communities={communities}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[148px] justify-between self-end">
                Navigate
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="right-0 mt-3 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(21,40,75,0.12)]">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                POP Brief Navigation
              </div>
              <div className="space-y-1">
                {POP_BRIEF_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  if (!item.href) {
                    return (
                      <div key={item.label} className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div>
                            <div className="font-semibold">{item.label}</div>
                            <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`block rounded-xl px-3 py-3 text-sm transition-colors ${
                        pathname === item.href
                          ? "bg-[#F4F7FB] text-[#15284B]"
                          : "text-slate-700 hover:bg-slate-50 hover:text-[#15284B]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div>
                          <div className="font-semibold">{item.label}</div>
                          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
