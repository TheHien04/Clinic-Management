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
    const cacheKey = `cache:${req.originalUrl || req.url}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json({
          success: true,
          data: JSON.parse(cachedData),
          cached: true,
          cachedAt: new Date().toISOString()
        });
      }
      console.log(`❌ Cache MISS: ${cacheKey}`);
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode === 200 && body.success) {
          redisClient.setEx(cacheKey, duration, JSON.stringify(body.data)).catch(err => console.error('Cache write error:', err));
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
