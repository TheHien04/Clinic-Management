import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
// Redis support (optional)
// import RedisStore from 'rate-limit-redis';
// import { getRedisClient } from '../config/redis.js';

/**
 * General API Rate Limiter
 * Read-heavy clinical workspaces legitimately load several governed resources
 * in parallel. Keep a broad abuse ceiling here; mutation-specific limiters below
 * remain intentionally strict.
 */
export const generalLimiter = rateLimit({
  // store: getRedisClient() ? new RedisStore({ client: getRedisClient(), prefix: 'rl:general:' }) : undefined,
  windowMs: 15 * 60 * 1000,
  max: 600,
  skip: (req) => req.method === 'OPTIONS' || req.path === '/health',
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
  // This limiter protects appointment creation/update volume. Applying it to
  // GET requests made the read-only dashboard exhaust a patient's daily quota.
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  keyGenerator: (req) =>
    req.user ? `user:${req.user.userId}` : ipKeyGenerator(req.ip ?? ''),
  message: {
    success: false,
    message: 'Daily appointment creation limit exceeded.'
  }
});
