import { ArrowLeft, FolderKanban, LayoutDashboard, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <main className="flex min-h-full flex-1 items-center justify-center p-6" aria-labelledby="not-found-title">
            <section className="w-full max-w-xl rounded-2xl border border-border/70 bg-card p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <SearchX className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mb-2 text-sm font-semibold text-primary">404</p>
                <h1 id="not-found-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight">
                    {t("navigation.not_found.title", "Aradığınız sayfa bulunamadı")}
                </h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    {t("navigation.not_found.description", "Bağlantı hatalı, kayıt taşınmış veya artık erişilebilir olmayabilir.")}
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t("common.back", "Geri dön")}
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/projects">
                            <FolderKanban className="mr-2 h-4 w-4" />
                            {t("common.projects")}
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link to="/dashboard">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            {t("common.dashboard")}
                        </Link>
                    </Button>
                </div>
            </section>
        </main>
    );
}
