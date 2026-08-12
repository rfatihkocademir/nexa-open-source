import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "md" | "lg"
}

export function LoadingSpinner({ className, size = "md", ...props }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: "h-4 w-4",
        md: "h-6 w-6",
        lg: "h-8 w-8",
    }

    return (
        <div role="status" aria-label="Yükleniyor" className={cn("flex justify-center items-center", className)} {...props}>
            <Loader2 aria-hidden="true" className={cn("animate-spin text-primary", sizeClasses[size])} />
            <span className="sr-only">Yükleniyor</span>
        </div>
    )
}
