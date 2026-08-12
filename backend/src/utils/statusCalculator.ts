import { ResultStatus } from '@prisma/client';

export function calculateFinalStatus(
    manualStatus: ResultStatus,
    automationStatus: ResultStatus | null
): ResultStatus {
    // 1. If no automation, final is manual
    if (!automationStatus) {
        return manualStatus;
    }

    // 2. If manual is UNTESTED, take automation status
    if (manualStatus === ResultStatus.UNTESTED) {
        return automationStatus;
    }

    // 3. If automation is UNTESTED, take manual status
    if (automationStatus === ResultStatus.UNTESTED) {
        return manualStatus;
    }

    // 4. If both executed
    if (manualStatus === automationStatus) {
        return manualStatus;
    } else {
        return ResultStatus.CONFLICT;
    }
}
