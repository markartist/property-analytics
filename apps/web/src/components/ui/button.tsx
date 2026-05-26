import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        default: "bg-[#15284B] text-white shadow-[0_10px_24px_rgba(21,40,75,0.18)] hover:-translate-y-0.5 hover:bg-[#0f1e39] hover:shadow-[0_14px_28px_rgba(21,40,75,0.24)]",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline: "border border-slate-300 bg-white text-[#15284B] shadow-sm hover:-translate-y-0.5 hover:border-[#15284B]/35 hover:bg-slate-50 hover:shadow-md",
        secondary: "bg-[#0D5E6D] text-white shadow-[0_10px_24px_rgba(13,94,109,0.18)] hover:-translate-y-0.5 hover:bg-[#0a4d59]",
        ghost: "text-[#15284B] hover:bg-slate-100 hover:text-[#15284B]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
