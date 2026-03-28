import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
// Redis support (optional)
// import RedisStore from 'rate-limit-redis';
// import { getRedisClient } from '../config/redis.js';

/**
 * General API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  // store: getRedisClient() ? new RedisStore({ client: getRedisClient(), prefix: 'rl:general:' }) : undefined,
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Auth Rate Limiter
 * Stricter limits for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  // store: getRedisClient() ? new RedisStore({ client: getRedisClient(), prefix: 'rl:auth:' }) : undefined,
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  }
});

/**
 * File Upload Rate Limiter
 * 10 uploads per hour per user
 */
export const uploadLimiter = rateLimit({
  // store: getRedisClient() ? new RedisStore({ client: getRedisClient(), prefix: 'rl:upload:' }) : undefined,
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Upload limit exceeded. Maximum 10 uploads per hour.'
  }
});

/**
 * Create Appointment Rate Limiter
 * 20 appointments per day per patient
 */
export const appointmentLimiter = rateLimit({
  // store: getRedisClient() ? new RedisStore({ client: getRedisClient(), prefix: 'rl:appointment:' }) : undefined,
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) =>
    req.user ? `user:${req.user.userId}` : ipKeyGenerator(req.ip ?? ''),
  message: {
    success: false,
    message: 'Daily appointment creation limit exceeded.'
  }
});
