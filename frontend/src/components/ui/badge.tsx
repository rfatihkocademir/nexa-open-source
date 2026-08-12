import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-5 items-center rounded-[5px] border px-1.5 py-0.5 text-[11px] font-medium leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-primary/15 text-primary",
        success:
          "border-success/30 bg-success/18 text-success",
        warning:
          "border-warning/30 bg-warning/18 text-warning",
        info:
          "border-info/30 bg-info/18 text-info",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/28 bg-destructive/15 text-destructive",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
