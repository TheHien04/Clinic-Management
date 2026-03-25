import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { csrfProtection, issueCsrfToken } from '../../../src/middleware/csrf.js';

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('csrf middleware', () => {
  const originalEnable = process.env.ENABLE_CSRF_TOKEN;
  const originalCookieName = process.env.CSRF_COOKIE_NAME;

  beforeEach(() => {
    process.env.CSRF_COOKIE_NAME = 'csrf_token';
  });

  afterEach(() => {
    process.env.ENABLE_CSRF_TOKEN = originalEnable;
    process.env.CSRF_COOKIE_NAME = originalCookieName;
  });

  it('issues token payload when enabled', () => {
    process.env.ENABLE_CSRF_TOKEN = 'true';
    const req = {};
    const res = createRes();

    issueCsrfToken(req, res);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledTimes(1);
  });

  it('skips validation when disabled', () => {
    process.env.ENABLE_CSRF_TOKEN = 'false';
    const req = { method: 'POST', cookies: {}, get: () => '' };
    const res = createRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid token on state-changing methods when enabled', () => {
    process.env.ENABLE_CSRF_TOKEN = 'true';
    const req = {
      method: 'POST',
      cookies: { csrf_token: 'cookie-value' },
      get: () => 'header-value',
    };
    const res = createRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts matching token pair when enabled', () => {
    process.env.ENABLE_CSRF_TOKEN = 'true';
    const req = {
      method: 'PATCH',
      cookies: { csrf_token: 'same-token' },
      get: () => 'same-token',
    };
    const res = createRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
