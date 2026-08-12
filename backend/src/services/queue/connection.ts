import { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import net from 'net';
import { createLogger } from '../../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const logger = createLogger('RedisCache');

// BullMQ Connection Options
export const connection: ConnectionOptions = {
    host: new URL(redisUrl).hostname,
    port: parseInt(new URL(redisUrl).port || '6379'),
    maxRetriesPerRequest: null, // Required by BullMQ
};

let cacheRedisClient: Redis | null = null;

export const isRedisAvailable = async (): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
            const socket = net.createConnection({
                host: connection.host as string,
                port: connection.port as number,
            });

            const finalize = (value: boolean) => {
                socket.removeAllListeners();
                socket.destroy();
                resolve(value);
            };

            socket.setTimeout(1000);
            socket.once('connect', () => finalize(true));
            socket.once('timeout', () => finalize(false));
            socket.once('error', () => finalize(false));
    });
};

const getCacheRedisClient = async (): Promise<Redis | null> => {
    const redisEnabled = await isRedisAvailable();
    if (!redisEnabled) {
        return null;
    }

    if (!cacheRedisClient) {
        cacheRedisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });

        cacheRedisClient.on('error', (err) => {
            logger.warn('Connection error:', err instanceof Error ? err.message : err);
        });

        cacheRedisClient.on('connect', () => {
            logger.info('Connected');
        });
    }

    return cacheRedisClient;
};

export const redisClient = {
    async get(key: string): Promise<string | null> {
        const client = await getCacheRedisClient();
        if (!client) {
            return null;
        }
        return client.get(key);
    },
    async setex(key: string, seconds: number, value: string): Promise<'OK' | null> {
        const client = await getCacheRedisClient();
        if (!client) {
            return null;
        }
        return client.setex(key, seconds, value);
    },
    async del(...keys: string[]): Promise<number | null> {
        const client = await getCacheRedisClient();
        if (!client || keys.length === 0) {
            return null;
        }
        return client.del(...keys);
    },
    async keys(pattern: string): Promise<string[]> {
        const client = await getCacheRedisClient();
        if (!client) {
            return [];
        }
        return client.keys(pattern);
    },
    async acquireLock(key: string, owner: string, ttlMs: number): Promise<boolean | null> {
        const client = await getCacheRedisClient();
        if (!client) return null;
        try {
            return (await client.set(key, owner, 'PX', ttlMs, 'NX')) === 'OK';
        } catch (error) {
            logger.warn('Lock acquisition failed:', error instanceof Error ? error.message : error);
            return null;
        }
    },
    async renewLock(key: string, owner: string, ttlMs: number): Promise<boolean | null> {
        const client = await getCacheRedisClient();
        if (!client) return null;
        try {
            const renewed = await client.eval(
                'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end',
                1,
                key,
                owner,
                String(ttlMs),
            );
            return Number(renewed) === 1;
        } catch (error) {
            logger.warn('Lock renewal failed:', error instanceof Error ? error.message : error);
            return null;
        }
    },
    async releaseLock(key: string, owner: string): Promise<boolean | null> {
        const client = await getCacheRedisClient();
        if (!client) return null;
        try {
            const released = await client.eval(
                'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
                1,
                key,
                owner,
            );
            return Number(released) === 1;
        } catch (error) {
            logger.warn('Lock release failed:', error instanceof Error ? error.message : error);
            return null;
        }
    },
};
