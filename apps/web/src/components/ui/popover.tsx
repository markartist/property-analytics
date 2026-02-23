"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue>({ open: false, setOpen: () => {} });

function Popover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, children, asChild, ...props }, ref) => {
  const { open, setOpen } = React.useContext(PopoverContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(!open);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      ref,
    });
  }

  return (
    <button ref={ref} onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = React.useContext(PopoverContext);

    React.useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-popover-content]") && !target.closest("[data-popover-trigger]")) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open, setOpen]);

    if (!open) return null;

    return (
      <div
        ref={ref}
        data-popover-content
        className={cn(
          "absolute z-50 mt-2 w-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
