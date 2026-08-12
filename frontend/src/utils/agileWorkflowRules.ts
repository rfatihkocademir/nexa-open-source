import type { Story } from "@/types/agile";
import type { AgileBoardColumn } from "@/services/agile.service";
import i18n from "@/lib/i18n";

export interface WorkflowValidationResult {
    allowed: boolean;
    message?: string;
    requireConfirmation?: boolean;
    autoTransitionParentId?: string;
    autoTransitionColumnId?: string;
}

/**
 * Checks if a sub-task is a development sub-task.
 */
export function isDevelopmentSubTask(item: Story): boolean {
    if (!item.parentId) return false;
    const title = (item.title || item.name || "").toLowerCase();
    return title.includes("geliştirme") || title.includes("development") || title.includes("dev");
}

/**
 * Checks if a sub-task is a test sub-task.
 */
export function isTestSubTask(item: Story): boolean {
    if (!item.parentId) return false;
    const title = (item.title || item.name || "").toLowerCase();
    return title.includes("test") || title.includes("testing");
}

/**
 * Validates a status transition on the agile board.
 *
 * Priority order:
 * 1. If the SOURCE column has `allowedTransitions` configured (non-empty array),
 *    check if the target column is in that list. If not → block.
 * 2. Apply quality gate rules (bug checks, test sub-task checks).
 * 3. If a development sub-task moves to Done → ask confirmation & auto-transition parent.
 */
export function validateWorkflowTransition(
    item: Story,
    targetColumnId: string,
    columns: AgileBoardColumn[],
    sourceColumnId?: string
): WorkflowValidationResult {
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return { allowed: true };

    // ─── RULE 0: allowedTransitions enforcement ──────────────────────────────
    if (sourceColumnId) {
        const sourceColumn = columns.find(c => c.id === sourceColumnId);
        if (sourceColumn?.allowedTransitions && sourceColumn.allowedTransitions.length > 0) {
            const isAllowed = sourceColumn.allowedTransitions.includes(targetColumnId);
            if (!isAllowed) {
                const allowedNames = sourceColumn.allowedTransitions
                    .map(id => columns.find(c => c.id === id)?.name ?? id)
                    .join(', ');
                return {
                    allowed: false,
                    message: i18n.t('agile_board.workflow.allowed_transitions', { source: sourceColumn.name, targets: allowedNames })
                };
            }
        }
    }

    const targetColumnName = targetColumn.name.toUpperCase();
    const isDoneOrProd = targetColumnName === "DONE"
        || targetColumnName === "READY FOR PROD"
        || targetColumn.mappedStatus === "DONE"
        || targetColumn.mappedStatus === "CLOSED";

    // ─── RULE 1: Development sub-task marked DONE ────────────────────────────
    if (isDevelopmentSubTask(item) && isDoneOrProd) {
        const readyForTestCol = columns.find(c => {
            const name = c.name.toUpperCase();
            return name.includes("READY FOR TEST") || name.includes("TESTE HAZIR") || c.mappedStatus === "READY_FOR_TEST";
        });

        return {
            allowed: true,
            requireConfirmation: true,
            message: i18n.t('agile_board.workflow.development_confirmation'),
            autoTransitionParentId: item.parentId || undefined,
            autoTransitionColumnId: readyForTestCol?.id
        };
    }

    // ─── RULE 2: Parent Task moving to DONE — check unresolved bugs ──────────
    if (!item.parentId && isDoneOrProd) {
        const childBugs = item.bugs || [];
        const unresolvedBugs = childBugs.filter(bug => {
            const status = (bug.status || "").toUpperCase();
            return status !== "DONE" && status !== "CLOSED" && status !== "REJECTED";
        });

        if (unresolvedBugs.length > 0) {
            return {
                allowed: false,
                message: i18n.t('agile_board.workflow.unresolved_bugs', { count: unresolvedBugs.length })
            };
        }

        // Check for test sub-task completion
        const childTasks = item.tasks || [];
        const testSubTask = childTasks.find(isTestSubTask);
        if (testSubTask) {
            const testStatus = (testSubTask.status || "").toUpperCase();
            if (testStatus !== "DONE" && testStatus !== "CLOSED") {
                return {
                    allowed: false,
                    message: i18n.t('agile_board.workflow.test_incomplete')
                };
            }
        }
    }

    return { allowed: true };
}
