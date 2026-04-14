"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: [
          "rounded-lg bg-(--brand-amber) text-white",
          "shadow-(--shadow-amber)",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:-translate-y-0.5 hover:bg-(--brand-amber-hover)",
          "hover:shadow-[0_12px_30px_rgba(232,134,26,0.4)]",
          "active:translate-y-0 active:shadow-(--shadow-amber)",
          "focus-visible:ring-(--brand-amber)",
        ],
        secondary: [
          "rounded-lg bg-(--brand-primary) text-white",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:-translate-y-0.5 hover:bg-(--brand-primary-hover)",
          "hover:shadow-(--shadow-green)",
          "active:translate-y-0",
          "focus-visible:ring-(--brand-primary)",
        ],
        default: [
          "rounded-lg bg-(--brand-primary) text-white",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:-translate-y-0.5 hover:bg-(--brand-primary-hover)",
          "hover:shadow-(--shadow-green)",
          "active:translate-y-0",
          "focus-visible:ring-(--brand-primary)",
        ],
        ghost: [
          "rounded-lg bg-transparent text-foreground",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:bg-(--color-elevated)",
          "focus-visible:ring-(--color-border)",
        ],
        outline: [
          "rounded-lg border border-(--color-border) bg-transparent text-foreground",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:bg-(--color-elevated) hover:border-(--color-border-strong)",
          "focus-visible:ring-(--color-border)",
        ],
        destructive: [
          "rounded-lg bg-(--color-error) text-white",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:-translate-y-0.5 hover:bg-red-700",
          "active:translate-y-0",
          "focus-visible:ring-(--color-error)",
        ],
        icon: [
          "rounded-md border border-(--color-border)",
          "bg-(--color-surface) text-(--color-text-secondary)",
          "duration-(--duration-fast) ease-(--ease-premium)",
          "hover:bg-(--color-elevated) hover:text-foreground",
          "focus-visible:ring-(--brand-primary)",
        ],
        link: [
          "text-(--brand-primary) underline-offset-4 hover:underline",
          "focus-visible:ring-(--brand-primary)",
        ],
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
        default: "h-10 px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
