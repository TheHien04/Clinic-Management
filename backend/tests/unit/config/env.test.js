import { afterEach, describe, expect, it } from 'vitest';
import { getAllowedOrigins, validateProductionEnv } from '../../../src/config/env.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('production environment guardrails', () => {
  it('rejects weak or reused JWT secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'db-password';
    process.env.CORS_ORIGIN = 'https://clinic.example';
    process.env.SOCKET_CORS_ORIGIN = 'https://clinic.example';
    process.env.DB_ENCRYPT = 'true';
    process.env.JWT_SECRET = 'short-secret';
    process.env.JWT_REFRESH_SECRET = 'another-short-secret';

    expect(() => validateProductionEnv()).toThrow(/unique random secret/);
  });

  it('rejects wildcard origins and allows explicit local development exceptions', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'db-password';
    process.env.DB_ENCRYPT = 'true';
    process.env.JWT_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.CORS_ORIGIN = '*';
    process.env.SOCKET_CORS_ORIGIN = 'https://clinic.example';
    expect(() => validateProductionEnv()).toThrow(/Wildcard CORS/);

    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGIN;
    expect(getAllowedOrigins('CORS_ORIGIN')).toEqual(['http://localhost:5173']);
  });
});
