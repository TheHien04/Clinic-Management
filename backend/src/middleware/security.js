/**
 * Security middleware: rate limiting & brute-force protection
 */

import rateLimit from 'express-rate-limit';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createRateLimiter = ({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
} = {}) => rateLimit({
  windowMs: toInt(windowMs, 15 * 60 * 1000),
  max: toInt(max, 100),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests,
  message: {
    success: false,
    message: message || 'Too many requests. Please try again later.',
  },
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

export const apiRateLimiter = createRateLimiter({
  windowMs: process.env.API_RATE_LIMIT_WINDOW_MS,
  max: process.env.API_RATE_LIMIT_MAX,
  message: 'API rate limit exceeded. Please try again later.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: process.env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication requests. Please retry shortly.',
});

export const loginRateLimiter = createRateLimiter({
  windowMs: process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: process.env.LOGIN_RATE_LIMIT_MAX,
  message: 'Too many failed login attempts. Please wait before trying again.',
  skipSuccessfulRequests: true,
});

export default {
  createRateLimiter,
  apiRateLimiter,
  authRateLimiter,
  loginRateLimiter,
};
