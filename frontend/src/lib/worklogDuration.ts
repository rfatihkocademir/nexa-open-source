const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 8 * MINUTES_PER_HOUR;
const MINUTES_PER_WEEK = 5 * MINUTES_PER_DAY;

const UNIT_MINUTES = {
    w: MINUTES_PER_WEEK,
    d: MINUTES_PER_DAY,
    h: MINUTES_PER_HOUR,
    m: 1,
} as const;

type DurationUnit = keyof typeof UNIT_MINUTES;

/**
 * Converts a Jira-style duration to the canonical unit used by the API.
 * A bare integer is kept as a backwards-compatible shorthand for minutes.
 */
export function parseWorklogDuration(value: string): number | null {
    const input = value.trim();
    if (!input) return null;

    if (/^\d+$/.test(input)) {
        const minutes = Number(input);
        return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
    }

    const compact = input.replace(/\s+/g, '');
    const tokenPattern = /(\d+(?:\.\d+)?)([wdhm])/gi;
    let cursor = 0;
    let previousUnitRank = Number.POSITIVE_INFINITY;
    let total = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(compact)) !== null) {
        if (match.index !== cursor) return null;

        const amount = Number(match[1]);
        const unit = match[2].toLowerCase() as DurationUnit;
        const unitRank = { w: 4, d: 3, h: 2, m: 1 }[unit];

        // Jira durations are ordered from the largest unit to the smallest.
        if (!Number.isFinite(amount) || amount <= 0 || unitRank >= previousUnitRank) return null;

        total += amount * UNIT_MINUTES[unit];
        previousUnitRank = unitRank;
        cursor = tokenPattern.lastIndex;
    }

    if (cursor !== compact.length || !Number.isSafeInteger(total) || total <= 0) return null;
    return total;
}

/** Formats canonical minutes using Jira's w/d/h/m notation (8h/day, 5d/week). */
export function formatWorklogDuration(minutes: number | null | undefined): string {
    const value = Math.max(0, Math.floor(minutes ?? 0));
    if (!value) return '0m';

    let remainder = value;
    const parts: string[] = [];
    const units: Array<[string, number]> = [
        ['w', MINUTES_PER_WEEK],
        ['d', MINUTES_PER_DAY],
        ['h', MINUTES_PER_HOUR],
        ['m', 1],
    ];

    for (const [unit, unitMinutes] of units) {
        const amount = Math.floor(remainder / unitMinutes);
        if (amount > 0) {
            parts.push(`${amount}${unit}`);
            remainder %= unitMinutes;
        }
    }

    return parts.join(' ');
}
