import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, id, "aria-label": ariaLabel, placeholder, ...props }, ref) => {
    return (
      <input
        type={type}
        id={id}
        aria-label={ariaLabel || (!id && typeof placeholder === "string" ? placeholder : undefined)}
        placeholder={placeholder}
        className={cn(
          "density-control flex w-full rounded-[var(--radius-control)] border border-input bg-card px-3 py-2 text-sm font-normal text-foreground caret-foreground shadow-sm transition-[border-color,box-shadow,background-color,color,height] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
