import { describe, it, expect } from 'vitest';
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
} from '../../../src/utils/jwt.js';

describe('jwt utils', () => {
  it('generates and verifies access token', () => {
    const payload = { id: 10, email: 'patient@clinic.com', role: 'patient' };
    const token = generateToken(payload);

    expect(typeof token).toBe('string');
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('generates and verifies refresh token', () => {
    const payload = { id: 11, role: 'doctor' };
    const token = generateRefreshToken(payload);

    expect(typeof token).toBe('string');
    const decoded = verifyRefreshToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.role).toBe(payload.role);
  });

  it('throws on invalid access token', () => {
    expect(() => verifyToken('invalid.token.value')).toThrow();
  });

  it('throws on invalid refresh token', () => {
    expect(() => verifyRefreshToken('invalid.token.value')).toThrow();
  });
});
