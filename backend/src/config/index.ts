import dotenv from 'dotenv';

dotenv.config();

function requireEnvironment(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} must be defined`);
    return value;
}

const jwtSecret = requireEnvironment('JWT_SECRET');
const databaseUrl = requireEnvironment('DATABASE_URL');

if (process.env.NODE_ENV === 'production') {
    const requiredProductionValues = [
        'DATA_ENCRYPTION_KEY',
        'AUDIT_SIGNING_KEY',
        'BACKEND_PUBLIC_URL',
        'FRONTEND_URL',
        'MINIO_ACCESS_KEY',
        'MINIO_SECRET_KEY',
    ];
    for (const key of requiredProductionValues) requireEnvironment(key);

    if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
    if (requireEnvironment('AUDIT_SIGNING_KEY').length < 32) {
        throw new Error('AUDIT_SIGNING_KEY must contain at least 32 characters');
    }

    const encryptionKey = Buffer.from(requireEnvironment('DATA_ENCRYPTION_KEY'), 'base64');
    if (encryptionKey.length !== 32) {
        throw new Error('DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }

    for (const key of ['BACKEND_PUBLIC_URL', 'FRONTEND_URL']) {
        const url = new URL(requireEnvironment(key));
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${key} must use HTTP or HTTPS`);
    }

    if (process.env.ALLOW_PUBLIC_REGISTRATION === 'true'
        && process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
        && !process.env.EMAIL_WEBHOOK_URL) {
        throw new Error('EMAIL_WEBHOOK_URL is required when public registration and email verification are enabled');
    }
}

export const config = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    dbUrl: databaseUrl,
};
