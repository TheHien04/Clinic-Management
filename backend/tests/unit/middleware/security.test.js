import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../../../src/middleware/security.js';

describe('security rate limiter', () => {
  it('returns 429 after exceeding max requests', async () => {
    const app = express();
    app.use(createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Rate limit hit',
    }));
    app.get('/ping', (req, res) => res.json({ success: true }));

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
    const blocked = await request(app).get('/ping').expect(429);

    expect(blocked.body.success).toBe(false);
    expect(blocked.body.message).toBe('Rate limit hit');
  });

  it('supports skipSuccessfulRequests for brute-force style limiter', async () => {
    const app = express();
    let failCount = 0;

    app.use(createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Too many failed attempts',
      skipSuccessfulRequests: true,
    }));

    app.get('/login-attempt', (req, res) => {
      failCount += 1;
      if (failCount <= 2) {
        return res.status(401).json({ success: false });
      }
      return res.status(200).json({ success: true });
    });

    await request(app).get('/login-attempt').expect(401);
    await request(app).get('/login-attempt').expect(401);
    await request(app).get('/login-attempt').expect(429);
  });
});
