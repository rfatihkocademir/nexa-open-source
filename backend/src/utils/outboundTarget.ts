import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from './AppError';

const PRIVATE_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata.google.internal.']);

type OutboundTargetScope = 'automation' | 'api';

const configuredAllowedHosts = (scope?: OutboundTargetScope): Set<string> => new Set(
    ((scope === 'automation'
        ? process.env.AUTOMATION_ALLOWED_HOSTS
        : scope === 'api'
            ? process.env.API_OUTBOUND_ALLOWED_HOSTS
            : '') || '')
        .split(',')
        .map((host) => host.trim().toLowerCase().replace(/\.$/, ''))
        .filter(Boolean),
);

const isAllowedHost = (host: string, allowedHosts: Set<string>): boolean => {
    const normalized = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    return allowedHosts.has(normalized) || Array.from(allowedHosts).some((entry) =>
        entry.startsWith('*.') && normalized.endsWith(entry.slice(1)),
    );
};

const isForbiddenAddress = (address: string): boolean => {
    const normalized = address.toLowerCase().split('%')[0];
    const mappedIpv4 = normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized;

    if (net.isIP(mappedIpv4) === 4) {
        const octets = mappedIpv4.split('.').map(Number);
        const [first, second] = octets;
        return first === 0 || first === 10 || first === 127 ||
            (first === 100 && second >= 64 && second <= 127) ||
            (first === 169 && second === 254) ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && (second === 0 || second === 168)) ||
            (first === 192 && second === 2) ||
            (first === 198 && second === 51) ||
            (first === 198 && (second === 18 || second === 19)) ||
            (first === 203 && second === 0) ||
            first >= 224;
    }

    if (net.isIP(normalized) === 6) {
        return normalized === '::' || normalized === '::1' || normalized.startsWith('::ffff:') ||
            normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') ||
            normalized.startsWith('ff') || normalized.startsWith('2001:db8:');
    }

    return true;
};

export type OutboundTargetOptions = {
    scope?: OutboundTargetScope;
    allowedHosts?: Iterable<string>;
};

const privateTargetError = (host: string, scope?: OutboundTargetScope): AppError => {
    const allowlistName = scope === 'api' ? 'API_OUTBOUND_ALLOWED_HOSTS' : 'AUTOMATION_ALLOWED_HOSTS';
    return new AppError(
        `Private and local target "${host}" is not allowed. Add the exact host to ${allowlistName} for on-prem use.`,
        403,
    );
};

/**
 * Validates an outbound HTTP target before a server-side request or browser
 * navigation. Private destinations are only available through an explicit
 * host allowlist, preventing user-controlled SSRF targets by default.
 */
export const assertSafeOutboundTarget = async (
    rawUrl: string,
    options: OutboundTargetOptions = {},
): Promise<URL> => {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new AppError('Invalid target URL', 400);
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new AppError('Only authenticated-free HTTP(S) targets are allowed', 400);
    }

    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    const allowedHosts = new Set([
        ...configuredAllowedHosts(options.scope),
        ...(options.allowedHosts || []),
    ].map((entry) => entry.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')));
    const explicitlyAllowed = isAllowedHost(host, allowedHosts);

    if ((PRIVATE_HOSTS.has(host) || host.endsWith('.localhost') || host === '0.0.0.0') && !explicitlyAllowed) {
        throw privateTargetError(host, options.scope);
    }

    let addresses: string[];
    try {
        addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
        throw new AppError('Target host could not be resolved', 400);
    }

    if (addresses.length === 0) throw new AppError('Target host could not be resolved', 400);
    if (!explicitlyAllowed && addresses.some(isForbiddenAddress)) {
        throw privateTargetError(host, options.scope);
    }

    return parsed;
};

export const assertSafeAutomationTargets = async (
    steps: Array<{ actionType?: unknown; data?: unknown; locator?: unknown }>,
    variables: Record<string, string> = {},
): Promise<void> => {
    const resolve = (value: unknown) => String(value ?? '').replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => variables[key.trim()] ?? '');
    const baseValue = variables.BASE_URL || variables.base_url || variables.baseUrl;
    const baseUrl = baseValue
        ? await assertSafeOutboundTarget(
            /^https?:\/\//i.test(baseValue) ? baseValue : `http://${baseValue}`,
            { scope: 'automation' },
        )
        : undefined;

    for (const step of steps) {
        const actionType = String(step.actionType || '').toUpperCase();
        if (actionType !== 'NAVIGATE' && actionType !== 'GOTO' && actionType !== 'API_REQUEST') continue;
        let rawTarget = actionType === 'API_REQUEST' ? step.locator : (step.data || step.locator);
        if (actionType === 'API_REQUEST' && !rawTarget && typeof step.data === 'string') {
            try { rawTarget = (JSON.parse(step.data) as { url?: unknown }).url; } catch { /* generator reports malformed config */ }
        }
        const target = resolve(rawTarget).trim();
        if (!target || target === '/') {
            if (baseUrl) await assertSafeOutboundTarget(new URL('/', baseUrl).toString(), { scope: 'automation' });
            continue;
        }

        const targetUrl = target.startsWith('/')
            ? baseUrl ? new URL(target, baseUrl).toString() : (() => { throw new AppError('Relative automation URLs require BASE_URL', 400); })()
            : /^https?:\/\//i.test(target) ? target : `https://${target}`;
        await assertSafeOutboundTarget(targetUrl, { scope: 'automation' });
    }
};
