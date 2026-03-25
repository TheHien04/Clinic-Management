import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  validatePassword,
  isValidPhone,
  sanitizeInput,
  isValidDate,
} from '../../../src/utils/validators.js';

describe('validators utils', () => {
  it('validates email format', () => {
    expect(isValidEmail('doctor@clinic.com')).toBe(true);
    expect(isValidEmail('bad-email')).toBe(false);
  });

  it('validates password strength', () => {
    expect(validatePassword('12345').isValid).toBe(false);
    expect(validatePassword('123456').isValid).toBe(true);
  });

  it('validates phone numbers', () => {
    expect(isValidPhone('0901234567')).toBe(true);
    expect(isValidPhone('0901-234-567')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
  });

  it('sanitizes user input', () => {
    expect(sanitizeInput('  <script>alert(1)</script>  ')).toBe('scriptalert(1)/script');
    expect(sanitizeInput(' plain text ')).toBe('plain text');
    expect(sanitizeInput(123)).toBe(123);
  });

  it('validates date strings in YYYY-MM-DD', () => {
    expect(isValidDate('2026-03-26')).toBe(true);
    expect(isValidDate('2026-13-40')).toBe(false);
    expect(isValidDate('invalid')).toBe(false);
  });
});
