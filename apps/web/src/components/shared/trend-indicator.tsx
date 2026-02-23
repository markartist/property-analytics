"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendIndicatorProps {
  value: number | null | undefined;
  /** Set to false for metrics where up is bad (e.g. C&Ds) */
  isPositive?: boolean | null;
  isPercentage?: boolean;
  decimalPlaces?: number;
}

export function TrendIndicator({
  value,
  isPositive = null,
  isPercentage = true,
  decimalPlaces = 1,
}: TrendIndicatorProps) {
  const numValue = parseFloat(String(value)) || 0;

  let color = "text-slate-500";
  let bgColor = "bg-slate-100";
  let Icon = Minus;

  if (numValue > 0) {
    const good = isPositive !== false;
    color = good ? "text-green-600" : "text-red-600";
    bgColor = good ? "bg-green-50" : "bg-red-50";
    Icon = TrendingUp;
  } else if (numValue < 0) {
    const good = isPositive === false;
    color = good ? "text-green-600" : "text-red-600";
    bgColor = good ? "bg-green-50" : "bg-red-50";
    Icon = TrendingDown;
  }

  const displayValue = Math.abs(numValue).toFixed(decimalPlaces);

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${bgColor}`}>
      <Icon className={`h-3 w-3 ${color}`} />
      <span className={`text-sm font-medium ${color}`}>
        {displayValue}
        {isPercentage ? "%" : ""}
      </span>
    </div>
  );
}
