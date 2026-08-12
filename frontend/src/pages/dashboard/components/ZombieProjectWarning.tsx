import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { projectService } from "@/services/project.service"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/store/authStore";

export function ZombieProjectWarning() {
    const { t } = useTranslation()
    const user = useAuthStore((state) => state.user)

    const { data: warnings } = useQuery({
        queryKey: ["project-warnings"],
        queryFn: projectService.getWarnings,
        enabled: user?.role === 'ADMIN',
        staleTime: 5 * 60 * 1000 // 5 minutes
    })

    if (!warnings || warnings.length === 0) return null

    // Group all warnings into a single alert
    const projectNames = warnings.map((w: any) => w.projectName)

    return (
        <div className="mb-6">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('common.warning')}</AlertTitle>
                <AlertDescription>
                    {warnings.length === 1 ? (
                        t('dashboard.no_active_tester_warning', { projectName: projectNames[0] })
                    ) : (
                        <span>
                            {t('dashboard.no_active_tester_warning_plural', { count: warnings.length })}
                            <span className="font-semibold ml-1">
                                {projectNames.join(', ')}
                            </span>
                        </span>
                    )}
                </AlertDescription>
            </Alert>
        </div>
    )
}
