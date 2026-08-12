import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldAlert } from "lucide-react"

import { useTranslation } from "react-i18next"

export default function ForbiddenPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()

    return (
        <main className="flex min-h-full flex-1 items-center justify-center bg-muted/20 px-4 text-foreground" aria-labelledby="forbidden-title">
            <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card p-8 text-center shadow-sm sm:p-10">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
                    <ShieldAlert className="h-10 w-10 text-destructive" />
                </div>
                <h1 id="forbidden-title" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t('common.forbidden_title')}</h1>
                <p className="mt-2 text-base text-muted-foreground">
                    {t('common.forbidden_desc')}
                </p>
                <div className="mt-6 flex justify-center gap-2">
                    <Button variant="outline" onClick={() => navigate(-1)} size="lg">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t("common.back", "Geri dön")}
                    </Button>
                    <Button onClick={() => navigate("/")} size="lg">
                        {t('common.go_home')}
                    </Button>
                </div>
            </div>
        </main>
    )
}
