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

export function parseWorklogDuration(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }

    if (typeof value !== 'string') return null;
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
        if (!Number.isFinite(amount) || amount <= 0 || unitRank >= previousUnitRank) return null;

        total += amount * UNIT_MINUTES[unit];
        previousUnitRank = unitRank;
        cursor = tokenPattern.lastIndex;
    }

    if (cursor !== compact.length || !Number.isSafeInteger(total) || total <= 0) return null;
    return total;
}
