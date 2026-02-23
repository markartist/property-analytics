"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (v: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({ value: "", onValueChange: () => {} });

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;
  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-slate-100 p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        isActive
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-600 hover:text-slate-900",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
