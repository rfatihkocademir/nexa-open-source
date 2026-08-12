import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../services/queue/connection';
import { logger } from '../utils/logger';

/**
 * Express middleware to cache GET requests in Redis
 * @param durationInSeconds How long the cache should live (e.g. 300 = 5 minutes)
 */
export const cacheMiddleware = (durationInSeconds: number = 300) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Generate a unique cache key based on URL, query params and user scope
        // If organizationId exists on req.user, append it strictly for multi-tenancy safe caching
        const user = req.user as any;
        const userScope = user?.organizationId ? `org:${user.organizationId}` : 'public';
        const key = `cache:${userScope}:${req.originalUrl || req.url}`;

        try {
            const cachedResponse = await redisClient.get(key);

            if (cachedResponse) {
                logger.debug(`[Cache Hit] ${key}`);
                return res.status(200).json(JSON.parse(cachedResponse));
            }

            // Cache Miss: Wrap the res.json method to intercept the response payload
            logger.debug(`[Cache Miss] ${key}`);
            const originalJson = res.json.bind(res);

            res.json = (body: any): Response => {
                // Return immediately to client
                const response = originalJson(body);

                // Asynchronously save to redis
                // Only cache successful responses (2xx)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redisClient.setex(key, durationInSeconds, JSON.stringify(body)).catch(err => {
                        logger.error(`[Cache Set Error] ${key}:`, err);
                    });
                }

                return response;
            };

            next();
        } catch (error) {
            // Unlikely, but if Redis is completely down, bypass cache
            logger.error(`[Cache Middleware Error]`, error);
            next();
        }
    };
};
