import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "density-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,height,padding] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        success:
          "border-success bg-success text-success-foreground shadow-sm hover:bg-success/90",
        warning:
          "border-warning bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
        info:
          "border-info bg-info text-info-foreground shadow-sm hover:bg-info/90",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border-border bg-card text-foreground shadow-sm hover:border-[var(--border-strong)] hover:bg-muted/60",
        secondary:
          "border-secondary/20 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      },
      size: {
        default: "px-4 py-2",
        sm: "density-control-sm px-3 text-xs",
        lg: "density-control-lg px-5 text-sm",
        icon: "w-[var(--density-control-height)] px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
