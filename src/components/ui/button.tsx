import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-fg-2",
        secondary: "bg-raised text-foreground hover:bg-card-hover",
        outline: "border border-border text-foreground hover:bg-raised",
        ghost: "text-fg-2 hover:bg-raised hover:text-foreground",
        destructive: "bg-red-600 text-white hover:bg-red-500",
        water: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25",
        exercise: "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25",
        nutrition:
          "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25",
        points: "bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
