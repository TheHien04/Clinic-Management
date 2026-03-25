import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, authorize } from '../../../src/middleware/auth.js';
import { jwtConfig } from '../../../src/config/jwt.js';

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('auth middleware', () => {
  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = createRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next for valid token', () => {
    const token = jwt.sign({ id: 1, email: 'admin@clinic.com', role: 'admin' }, jwtConfig.secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 1, email: 'admin@clinic.com', role: 'admin' });
  });

  it('returns 401 for invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.value' } };
    const res = createRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  it('returns 401 when req.user is not set', () => {
    const middleware = authorize('admin');
    const req = {};
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not allowed', () => {
    const middleware = authorize('admin');
    const req = { user: { role: 'patient' } };
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when role is allowed', () => {
    const middleware = authorize('admin', 'doctor');
    const req = { user: { role: 'doctor' } };
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
