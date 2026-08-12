import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAppDialog } from "@/components/ui/app-dialog-context";

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { confirm } = useAppDialog();
    const confirmationOpen = useRef(false);

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        const handleLinkClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
            if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
            const url = new URL(target.href, window.location.href);
            if (url.origin !== window.location.origin || `${url.pathname}${url.search}${url.hash}` === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
            event.preventDefault();
            event.stopPropagation();
            if (confirmationOpen.current) return;
            confirmationOpen.current = true;
            void confirm({
                title: t("navigation.unsaved.title", "Kaydedilmemiş değişiklikler"),
                description: t("navigation.unsaved.description", "Bu sayfadan ayrılırsanız kaydedilmemiş değişiklikleriniz kaybolacak."),
                confirmLabel: t("navigation.unsaved.leave", "Değişiklikleri bırak"),
                cancelLabel: t("navigation.unsaved.stay", "Sayfada kal"),
                destructive: true,
            }).then((approved) => {
                if (approved) navigate(`${url.pathname}${url.search}${url.hash}`);
            }).finally(() => {
                confirmationOpen.current = false;
            });
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("click", handleLinkClick, true);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("click", handleLinkClick, true);
        };
    }, [confirm, hasUnsavedChanges, navigate, t]);
}
