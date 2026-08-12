import { CheckCircle2, CloudUpload } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AutoDraftStatus({ savedAt, isSaving }: { savedAt: string | null; isSaving: boolean }) {
    const { t, i18n } = useTranslation();
    if (!savedAt && !isSaving) return null;

    return (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
            {isSaving ? <CloudUpload className="h-3.5 w-3.5 animate-pulse" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
            <span>
                {isSaving
                    ? t("auto_draft.saving", "Taslak kaydediliyor…")
                    : t("auto_draft.saved", {
                        defaultValue: "Taslak {{time}} tarihinde kaydedildi",
                        time: new Date(savedAt!).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }),
                    })}
            </span>
        </div>
    );
}
