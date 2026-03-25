import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stateChangeOriginGuard } from '../../../src/middleware/requestGuard.js';

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('stateChangeOriginGuard', () => {
  const originalStrict = process.env.STRICT_ORIGIN_CHECK;
  const originalCors = process.env.CORS_ORIGIN;

  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
  });

  afterEach(() => {
    process.env.STRICT_ORIGIN_CHECK = originalStrict;
    process.env.CORS_ORIGIN = originalCors;
  });

  it('allows request when strict check is disabled', () => {
    process.env.STRICT_ORIGIN_CHECK = 'false';
    const req = { method: 'POST', headers: { origin: 'http://evil.com' } };
    const res = createRes();
    const next = vi.fn();

    stateChangeOriginGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks state-changing request from disallowed origin when strict check is enabled', () => {
    process.env.STRICT_ORIGIN_CHECK = 'true';
    const req = { method: 'POST', headers: { origin: 'http://evil.com' } };
    const res = createRes();
    const next = vi.fn();

    stateChangeOriginGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows state-changing request from allowed origin when strict check is enabled', () => {
    process.env.STRICT_ORIGIN_CHECK = 'true';
    const req = { method: 'DELETE', headers: { origin: 'http://localhost:5173' } };
    const res = createRes();
    const next = vi.fn();

    stateChangeOriginGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
