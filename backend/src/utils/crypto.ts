import crypto from 'node:crypto';

const VERSION = 'v1';

function encryptionKey(): Buffer {
    const raw = process.env.DATA_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('DATA_ENCRYPTION_KEY is required for encrypted data');
    }

    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length !== 32) {
        throw new Error('DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
    return decoded;
}

export function encryptString(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptString(payload: string): string {
    const [version, ivValue, tagValue, encryptedValue] = payload.split('.');
    if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
        throw new Error('Invalid encrypted payload');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

export function encryptJson(value: unknown): { _encrypted: string; _version: typeof VERSION } {
    return { _encrypted: encryptString(JSON.stringify(value)), _version: VERSION };
}

export function decryptJson<T>(value: unknown): T {
    if (!value || typeof value !== 'object' || !('_encrypted' in value)) {
        throw new Error('Integration configuration is not encrypted');
    }
    return JSON.parse(decryptString(String((value as { _encrypted: unknown })._encrypted))) as T;
}

export function hashToken(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
}

export function maskSecrets(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(maskSecrets);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /secret|token|password|api.?key|private.?key/i.test(key) ? '********' : maskSecrets(item),
    ]));
}
