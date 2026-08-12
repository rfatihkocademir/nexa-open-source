const GENERIC_WORDS = new Set([
    'THE',
    'A',
    'AN',
    'AND',
    'OR',
    'OF',
    'FOR',
    'TO',
    'IN',
    'ON',
    'WITH',
])

function normalizeWords(name: string): string[] {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .map((word) => word.toUpperCase())
        .filter(Boolean)
}

function compactSingleWord(word: string): string {
    const letters = word.replace(/[^A-Z0-9]/g, '')
    if (letters.length <= 5) return letters

    const first = letters[0]
    const consonants = letters.slice(1).replace(/[AEIOU]/g, '')
    const candidate = `${first}${consonants}`.slice(0, 5)
    return candidate.length >= 2 ? candidate : letters.slice(0, 5)
}

export function generateProjectKeyBase(name: string): string {
    const words = normalizeWords(name).filter((word) => !GENERIC_WORDS.has(word))

    if (words.length === 0) return 'PRJ'

    if (words.length === 1) {
        return compactSingleWord(words[0]).slice(0, 5).padEnd(2, 'X')
    }

    const initials = words.map((word) => word[0]).join('')
    if (initials.length >= 2) return initials.slice(0, 5)

    return compactSingleWord(words.join('')).slice(0, 5).padEnd(2, 'X')
}

export async function ensureUniqueProjectKey(
    baseName: string,
    exists: (candidate: string) => Promise<boolean>
): Promise<string> {
    const base = generateProjectKeyBase(baseName)
    let candidate = base
    let suffix = 2

    while (await exists(candidate)) {
        const suffixText = String(suffix)
        candidate = `${base.slice(0, Math.max(2, 5 - suffixText.length))}${suffixText}`
        suffix += 1
    }

    return candidate
}
