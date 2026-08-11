import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-zinc-800 text-zinc-200",
        water: "bg-cyan-500/15 text-cyan-300",
        exercise: "bg-amber-500/15 text-amber-300",
        nutrition: "bg-emerald-500/15 text-emerald-300",
        points: "bg-violet-500/15 text-violet-300",
        success: "bg-emerald-500/15 text-emerald-300",
        warning: "bg-amber-500/15 text-amber-300",
        muted: "bg-zinc-800 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
