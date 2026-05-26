"use client";

import Link from "next/link";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

type RestrictedSurfaceCardProps = {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function RestrictedSurfaceCard({
  title,
  description,
  primaryHref = "/",
  primaryLabel = "Back to The Pond",
  secondaryHref = "/dock",
  secondaryLabel = "Open The Dock",
}: RestrictedSurfaceCardProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#394867] p-3 text-white shadow-lg">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={primaryHref} className="inline-flex items-center rounded-md bg-[#15284B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#20314f]">
                  {primaryLabel}
                </Link>
                <Link href={secondaryHref} className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  {secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
