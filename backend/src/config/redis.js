import { createClient } from 'redis';

let redisClient = null;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  Redis URL not configured, caching disabled');
    return null;
  }
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return retries * 100;
        }
      }
    });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('✅ Redis connected'));
    redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection error:', error);
    return null;
  }
};

export const getRedisClient = () => redisClient;
