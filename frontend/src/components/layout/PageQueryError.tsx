import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface PageQueryErrorProps {
    onRetry?: () => void;
    title?: string;
    description?: string;
}

export function PageQueryError({ onRetry, title, description }: PageQueryErrorProps) {
    const { t } = useTranslation();

    return (
        <section role="alert" className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/[0.04] p-8 text-center">
            <AlertTriangle className="mb-4 h-9 w-9 text-destructive" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{title ?? t("common.load_error", "İçerik yüklenemedi")}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {description ?? t("common.load_error_description", "Bağlantınızı kontrol edip yeniden deneyin. Sorun devam ederse sistem yöneticinize başvurun.")}
            </p>
            {onRetry && (
                <Button className="mt-5" variant="outline" onClick={onRetry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("common.retry", "Yeniden dene")}
                </Button>
            )}
        </section>
    );
}
