import { ArrowLeft } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSmartBackNavigation } from "@/hooks/useSmartBackNavigation";
import { useTranslation } from "react-i18next";

interface PageBackButtonProps extends Omit<ButtonProps, "onClick"> {
    fallbackTo: string;
    label?: string;
}

export function PageBackButton({
    fallbackTo,
    label,
    className,
    variant = "outline",
    size = "sm",
    ...props
}: PageBackButtonProps) {
    const { t } = useTranslation();
    const { goBack } = useSmartBackNavigation(fallbackTo);

    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            className={cn("gap-2 rounded-md border-border/70", className)}
            onClick={goBack}
            {...props}
        >
            <ArrowLeft className="h-4 w-4" />
            {label ?? t("common.back", "Geri dön")}
        </Button>
    );
}
