export type QuickCreateKind = "TASK" | "BUG" | "ACTIVITY";

export const QUICK_CREATE_EVENT = "nexa:quick-create";

export function openQuickCreate(kind: QuickCreateKind = "TASK") {
    window.dispatchEvent(new CustomEvent(QUICK_CREATE_EVENT, { detail: { kind } }));
}
