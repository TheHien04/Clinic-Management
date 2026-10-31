import { getRedisClient } from '../config/redis.js';

/**
 * Cache Middleware
 * Caches GET requests in Redis
 * @param {number} duration - Cache duration in seconds (default: 300 = 5 minutes)
 */
export const cache = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    const redisClient = getRedisClient();
    if (!redisClient) return next();
    // Protected resources must never share a cache entry across identities or roles.
    // This middleware is mounted after authentication on the routes that use it.
    const identity = req.user?.id ? `user:${req.user.id}` : 'anonymous';
    const role = req.user?.role ? `role:${req.user.role}` : 'role:none';
    const cacheKey = `cache:${identity}:${role}:${req.originalUrl || req.url}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        const parsed = JSON.parse(cachedData);
        // Current entries preserve the complete response contract (pagination,
        // provenance, etc.). The array branch reads entries written by older
        // releases until their TTL expires.
        return res.json(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'success' in parsed
          ? { ...parsed, cached: true, cachedAt: new Date().toISOString() }
          : { success: true, data: parsed, cached: true, cachedAt: new Date().toISOString() });
      }
      console.log(`❌ Cache MISS: ${cacheKey}`);
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode === 200 && body.success) {
          redisClient.setEx(cacheKey, duration, JSON.stringify(body)).catch(err => console.error('Cache write error:', err));
        }
        return originalJson(body);
      };
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Clear cache for specific key pattern
 */
export const clearCache = async (pattern = '*') => {
  const redisClient = getRedisClient();
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗑️  Cleared ${keys.length} cache entries`);
    }
  } catch (error) {
    console.error('Clear cache error:', error);
  }
};
