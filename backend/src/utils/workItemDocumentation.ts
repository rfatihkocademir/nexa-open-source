const DOC_PAGE_MARKER_REGEX = /\n?\[TS_DOC_PAGE:([a-fA-F0-9-]{36})\]\s*$/;

export interface WorkItemDocMeta {
    description: string | null;
    documentationPageId: string | null;
}

export function extractDocumentationMeta(description: string | null | undefined): WorkItemDocMeta {
    if (typeof description !== 'string') {
        return {
            description: description ?? null,
            documentationPageId: null
        };
    }

    const match = description.match(DOC_PAGE_MARKER_REGEX);
    if (!match) {
        return {
            description,
            documentationPageId: null
        };
    }

    const cleaned = description.replace(DOC_PAGE_MARKER_REGEX, '').trimEnd();

    return {
        description: cleaned.length > 0 ? cleaned : null,
        documentationPageId: match[1]
    };
}

export function buildDescriptionWithDocumentation(
    description: string | null | undefined,
    documentationPageId: string | null | undefined
): string | null {
    const { description: cleanedDescription } = extractDocumentationMeta(description);
    const trimmedDocId = typeof documentationPageId === 'string' ? documentationPageId.trim() : '';

    if (!trimmedDocId) {
        return cleanedDescription;
    }

    const baseDescription = cleanedDescription?.trimEnd() ?? '';
    return baseDescription.length > 0
        ? `${baseDescription}\n\n[TS_DOC_PAGE:${trimmedDocId}]`
        : `[TS_DOC_PAGE:${trimmedDocId}]`;
}
