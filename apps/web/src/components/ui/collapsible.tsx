"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({ open: controlledOpen, onOpenChange, children, className }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <div className={className} data-state={open ? "open" : "closed"}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ open?: boolean; onToggle?: () => void }>, {
              open,
              onToggle: () => setOpen(!open),
            })
          : child
      )}
    </div>
  );
}

export function CollapsibleTrigger({
  children,
  className,
  open,
  onToggle,
}: {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("flex w-full items-center justify-between", className)}
    >
      {children}
      <ChevronDown
        className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
      />
    </button>
  );
}

export function CollapsibleContent({
  children,
  className,
  open,
}: {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  if (!open) return null;
  return <div className={className}>{children}</div>;
}
