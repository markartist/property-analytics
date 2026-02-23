"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendIndicator } from "./trend-indicator";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  delta?: number | null;
  subtitle?: string;
  icon?: LucideIcon;
  isPositiveChange?: boolean | null;
}

export function MetricCard({ title, value, delta, subtitle, icon: Icon, isPositiveChange = null }: MetricCardProps) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-600">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          {delta != null && delta !== 0 && (
            <TrendIndicator value={delta} isPositive={isPositiveChange} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
