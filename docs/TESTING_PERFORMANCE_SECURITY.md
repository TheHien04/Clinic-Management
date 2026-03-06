# 🧪 Testing, Performance & Security Implementation Guide

Chi tiết implementation cho Testing framework, Performance optimization, và Security hardening.

---

## 📑 MỤC LỤC

1. [Testing Framework Setup](#1-testing-framework-setup)
2. [Backend Unit Tests](#2-backend-unit-tests)
3. [API Integration Tests](#3-api-integration-tests)
4. [Performance Monitoring](#4-performance-monitoring)
5. [Security Hardening](#5-security-hardening)
6. [Rate Limiting](#6-rate-limiting)
7. [Redis Caching](#7-redis-caching)

---

## 1. TESTING FRAMEWORK SETUP

### File: `backend/package.json` (Update dependencies)

```json
{
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "supertest": "^6.3.3",
    "nodemon": "^3.0.1"
  },
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration"
  },
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"],
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/server.js"
    ],
    "testTimeout": 10000
  }
}
```

### File: `backend/tests/setup.js`

```javascript
// Test environment setup
process.env.NODE_ENV = 'test';
process.env.PORT = 5001;
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Database configuration for testing
process.env.DB_SERVER = 'localhost';
process.env.DB_NAME = 'ClinicDB_Test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Mock database queries for testing
const mockExecuteQuery = jest.fn();
jest.mock('../src/config/database', () => ({
  executeQuery: mockExecuteQuery
}));

global.mockExecuteQuery = mockExecuteQuery;

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## 2. BACKEND UNIT TESTS

### File: `backend/tests/unit/utils/jwt.test.js`

```javascript
const { generateToken, verifyToken, generateRefreshToken, verifyRefreshToken } = require('../../../src/utils/jwt');

describe('JWT Utilities', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = { userId: 1, role: 'patient' };
      const token = generateToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { userId: 1, role: 'patient' };
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(1);
      expect(decoded.role).toBe('patient');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw error for expired token', () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 1 }, 
        process.env.JWT_SECRET, 
        { expiresIn: '-1h' }
      );
      
      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload = { userId: 1 };
      const refreshToken = generateRefreshToken(payload);
      
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const payload = { userId: 1 };
      const refreshToken = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(refreshToken);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(1);
    });
  });
});
```

### File: `backend/tests/unit/utils/validators.test.js`

```javascript
const {
  isValidEmail,
  validatePassword,
  isValidPhone,
  sanitizeInput,
  isValidDate
} = require('../../../src/utils/validators');

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('Password123!').isValid).toBe(true);
      expect(validatePassword('MyP@ssw0rd').isValid).toBe(true);
    });

    it('should reject weak passwords', () => {
      const result1 = validatePassword('short');
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Password must be at least 8 characters');

      const result2 = validatePassword('onlylowercase');
      expect(result2.isValid).toBe(false);
      
      const result3 = validatePassword('NoDigits!');
      expect(result3.isValid).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate Vietnamese phone numbers', () => {
      expect(isValidPhone('0912345678')).toBe(true);
      expect(isValidPhone('84912345678')).toBe(true);
      expect(isValidPhone('+84912345678')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abcdefghij')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeInput('Hello<b>World</b>')).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });
  });

  describe('isValidDate', () => {
    it('should validate correct date strings', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('1990-12-31')).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(isValidDate('invalid-date')).toBe(false);
      expect(isValidDate('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDate('')).toBe(false);
    });
  });
});
```

### File: `backend/tests/unit/middleware/auth.test.js`

```javascript
const { authMiddleware, authorize } = require('../../../src/middleware/auth');
const { generateToken } = require('../../../src/utils/jwt');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid token', () => {
      const token = generateToken({ userId: 1, role: 'patient' });
      req.headers.authorization = `Bearer ${token}`;

      authMiddleware(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without token', () => {
      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'No token provided'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should allow access for authorized role', () => {
      req.user = { userId: 1, role: 'doctor' };
      const middleware = authorize('doctor', 'admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', () => {
      req.user = { userId: 1, role: 'patient' };
      const middleware = authorize('doctor', 'admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('not authorized')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
```

---

## 3. API INTEGRATION TESTS

### File: `backend/tests/integration/auth.test.js`

```javascript
const request = require('supertest');
const app = require('../../src/server'); // Your Express app

describe('Auth API Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new patient', async () => {
      const newPatient = {
        fullname: 'Test Patient',
        dateOfBirth: '1990-01-01',
        gender: 'M',
        phone: '0912345678',
        email: 'test@example.com',
        address: '123 Test St',
        username: 'testuser',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newPatient)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(newPatient.email);
    });

    it('should reject registration with invalid email', async () => {
      const invalidPatient = {
        fullname: 'Test Patient',
        email: 'invalid-email',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidPatient)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const weakPassword = {
        fullname: 'Test Patient',
        email: 'test@example.com',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPassword)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const credentials = {
        username: 'testuser',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject login with incorrect password', async () => {
      const credentials = {
        username: 'testuser',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject login for non-existent user', async () => {
      const credentials = {
        username: 'nonexistent',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!'
        });
      authToken = response.body.data.token;
    });

    it('should get current user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });
});
```

---

## 4. PERFORMANCE MONITORING

### File: `backend/src/middleware/performanceMonitor.js`

```javascript
/**
 * Performance Monitoring Middleware
 * Tracks request duration, memory usage, and slow queries
 */

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Store original end function
  const originalEnd = res.end;

  // Override end function
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    
    // Calculate metrics
    const metrics = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      memoryDelta: {
        heapUsed: `${((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
        rss: `${((endMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(2)} MB`
      }
    };

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn('⚠️  Slow Request Detected:', metrics);
    }

    // Log to performance log file (in production, use Winston)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with Winston or external monitoring service
      logPerformanceMetric(metrics);
    }

    // Restore original end function and call it
    originalEnd.apply(res, args);
  };

  next();
};

// Performance metrics storage (in-memory for demo, use Redis in production)
const performanceMetrics = {
  requests: [],
  slowQueries: [],
  errorRates: {}
};

const logPerformanceMetric = (metric) => {
  performanceMetrics.requests.push(metric);
  
  // Keep only last 1000 requests
  if (performanceMetrics.requests.length > 1000) {
    performanceMetrics.requests.shift();
  }
};

// Get performance summary
const getPerformanceSummary = () => {
  const totalRequests = performanceMetrics.requests.length;
  const avgDuration = performanceMetrics.requests.reduce((sum, req) => {
    return sum + parseInt(req.duration);
  }, 0) / totalRequests;

  const statusCodes = performanceMetrics.requests.reduce((acc, req) => {
    acc[req.statusCode] = (acc[req.statusCode] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRequests,
    avgDuration: `${avgDuration.toFixed(2)}ms`,
    statusCodes,
    slowRequests: performanceMetrics.requests.filter(r => parseInt(r.duration) > 1000).length
  };
};

// Database query performance tracker
const trackQueryPerformance = async (queryName, queryFn) => {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    // Log slow queries (> 500ms)
    if (duration > 500) {
      console.warn(`⚠️  Slow Query: ${queryName} took ${duration}ms`);
      performanceMetrics.slowQueries.push({
        queryName,
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query Error: ${queryName} failed after ${duration}ms`, error);
    throw error;
  }
};

module.exports = {
  performanceMonitor,
  getPerformanceSummary,
  trackQueryPerformance
};
```

### File: `backend/src/routes/monitoring.js`

```javascript
const express = require('express');
const router = express.Router();
const { getPerformanceSummary } = require('../middleware/performanceMonitor');
const { authMiddleware, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/monitoring/performance
 * @desc    Get performance metrics
 * @access  Admin only
 */
router.get('/performance', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const summary = getPerformanceSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/monitoring/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`
    },
    cpu: process.cpuUsage()
  };

  try {
    res.json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    healthCheck.message = 'ERROR';
    healthCheck.error = error.message;
    res.status(503).json({
      success: false,
      data: healthCheck
    });
  }
});

module.exports = router;
```

---

## 5. SECURITY HARDENING

### File: `backend/src/middleware/securityHeaders.js`

```javascript
const helmet = require('helmet');

/**
 * Security Headers Configuration
 * Implements OWASP best practices
 */

const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent clickjacking
  frameguard: {
    action: 'deny'
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Prevent MIME sniffing
  noSniff: true,
  
  // Enable XSS filter
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

module.exports = securityHeaders;
```

### File: `backend/src/middleware/inputSanitization.js`

```javascript
const { sanitizeInput } = require('../utils/validators');

/**
 * Input Sanitization Middleware
 * Sanitizes all incoming request data
 */

const sanitizeRequestData = (data) => {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeRequestData(value);
    }
    return sanitized;
  }
  
  return data;
};

const inputSanitization = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeRequestData(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeRequestData(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeRequestData(req.params);
  }
  
  next();
};

module.exports = inputSanitization;
```

---

## 6. RATE LIMITING

### File: `backend/src/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Create Redis client (if Redis is available)
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  redisClient.connect();
}

/**
 * General API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:general:'
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
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
const authLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }) : undefined,
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  }
});

/**
 * File Upload Rate Limiter
 * 10 uploads per hour per user
 */
const uploadLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:upload:'
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
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
const appointmentLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:appointment:'
  }) : undefined,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  keyGenerator: (req) => {
    // Use user ID instead of IP for authenticated requests
    return req.user ? `user:${req.user.userId}` : req.ip;
  },
  message: {
    success: false,
    message: 'Daily appointment creation limit exceeded.'
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  appointmentLimiter
};
```

### Usage in server.js:

```javascript
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

// Apply general rate limiting to all routes
app.use('/api/', generalLimiter);

// Apply stricter rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

---

## 7. REDIS CACHING

### File: `backend/src/config/redis.js`

```javascript
const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  Redis URL not configured, caching disabled');
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return retries * 100; // Exponential backoff
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

const getRedisClient = () => redisClient;

module.exports = {
  connectRedis,
  getRedisClient
};
```

### File: `backend/src/middleware/cacheMiddleware.js`

```javascript
const { getRedisClient } = require('../config/redis');

/**
 * Cache Middleware
 * Caches GET requests in Redis
 * 
 * @param {number} duration - Cache duration in seconds (default: 300 = 5 minutes)
 */
const cache = (duration = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const redisClient = getRedisClient();
    if (!redisClient) {
      return next(); // Skip caching if Redis not available
    }

    // Create cache key from URL and query params
    const cacheKey = `cache:${req.originalUrl || req.url}`;

    try {
      // Check if data exists in cache
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

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = (body) => {
        if (res.statusCode === 200 && body.success) {
          // Cache only successful responses
          redisClient.setEx(
            cacheKey,
            duration,
            JSON.stringify(body.data)
          ).catch(err => console.error('Cache write error:', err));
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
};

/**
 * Clear cache for specific key pattern
 */
const clearCache = async (pattern = '*') => {
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

module.exports = {
  cache,
  clearCache
};
```

### Usage Example:

```javascript
const { cache, clearCache } = require('../middleware/cacheMiddleware');

// Cache doctor list for 5 minutes
router.get('/doctors', cache(300), getDoctors);

// Cache patient details for 10 minutes
router.get('/patients/:id', cache(600), getPatientById);

// Clear cache after creating/updating
router.post('/appointments', async (req, res) => {
  // ... create appointment logic
  await clearCache('/api/appointments*');
  res.json({ success: true, data: appointment });
});
```

---

## 📊 Testing Commands

```bash
# Install testing dependencies
cd backend
npm install --save-dev jest supertest @types/jest

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch
```

---

## 🔒 Security Checklist

- [x] JWT authentication with secure secret
- [x] Password hashing with bcrypt (10 rounds)
- [x] Input sanitization on all endpoints
- [x] Rate limiting on sensitive endpoints
- [x] CORS configuration
- [x] Helmet.js security headers
- [x] SQL injection prevention (parameterized queries)
- [ ] HTTPS/TLS configuration (production deployment)
- [ ] Environment variable security (use secrets manager)
- [ ] Regular dependency updates (npm audit)

---

## 📈 Performance Benchmarks

**Target Metrics:**
- API response time: < 200ms (p95)
- Database query time: < 100ms (p95)
- Memory usage: < 512MB (typical)
- Cache hit rate: > 80%
- Error rate: < 1%

**Monitoring Tools:**
- Built-in performance middleware
- Redis for caching
- Rate limiting for protection
- Health check endpoint: `/api/monitoring/health`

---

**Tổng kết:** File này cung cấp implementations cho Testing, Performance Monitoring, Security Hardening, Rate Limiting, và Redis Caching.

**Tiếp theo:** DevOps configuration (Docker, CI/CD) trong file riêng.
