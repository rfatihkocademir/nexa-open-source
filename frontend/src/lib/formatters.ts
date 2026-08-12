export function formatNumber(value: number | null | undefined, language = 'tr-TR') {
    return new Intl.NumberFormat(language).format(value ?? 0)
}

export function formatDate(value: Date | string | number, language = 'tr-TR', options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(language, options ?? { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTime(value: Date | string | number, language = 'tr-TR') {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatDuration(minutes: number | null | undefined, language = 'tr-TR') {
    const value = Math.max(0, minutes ?? 0)
    if (!value) return '—'
    const hours = Math.floor(value / 60)
    const remainder = value % 60
    const units = language.startsWith('tr') ? { hour: 'sa', minute: 'dk' } : { hour: 'h', minute: 'm' }
    if (hours && remainder) return `${hours}${units.hour} ${remainder}${units.minute}`
    return hours ? `${hours}${units.hour}` : `${remainder}${units.minute}`
}
