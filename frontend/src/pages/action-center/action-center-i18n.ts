import type { i18n, TFunction } from "i18next";

export function localizeActionText(
    value: string,
    metadata: Record<string, unknown> | null | undefined,
    t: TFunction,
    i18nInstance: i18n,
) {
    if (!i18nInstance.exists(value)) return value;
    const interpolation = { ...(metadata || {}) };
    const initiativeStatus = interpolation.initiativeStatus;
    if (typeof initiativeStatus === "string") {
        const statusKey = `dashboard_studio.status.${initiativeStatus}`;
        const workflowKey = `agile_board.status_options.${initiativeStatus}`;
        if (i18nInstance.exists(statusKey)) interpolation.initiativeStatus = t(statusKey);
        else if (i18nInstance.exists(workflowKey)) interpolation.initiativeStatus = t(workflowKey);
    }
    return t(value, interpolation);
}
