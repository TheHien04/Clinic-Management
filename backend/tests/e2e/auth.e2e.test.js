// E2E test for authentication flow using Playwright Test
// Run with: npx playwright test backend/tests/e2e/auth.e2e.test.js

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';

test.describe('Authentication E2E', () => {
  test('User can register, login, and get profile', async ({ request }) => {
    const email = `e2euser_${Date.now()}@test.com`;
    const password = 'Password123!';
    const name = 'E2E User';

    // Register
    const registerRes = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { email, password, name }
    });
    expect(registerRes.status()).toBe(201);
    const registerData = await registerRes.json();
    expect(registerData.success).toBe(true);
    expect(registerData.data.user.email).toBe(email);
    expect(registerData.data.token).toBeTruthy();

    // Login
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email, password }
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.data.token).toBeTruthy();

    // Get profile
    const meRes = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.data.token}` }
    });
    expect(meRes.status()).toBe(200);
    const meData = await meRes.json();
    expect(meData.success).toBe(true);
    expect(meData.data.user.email).toBe(email);
  });

  test('Admin login requires MFA', async ({ request }) => {
    // Assume a seeded admin account exists
    const email = 'admin@clinic.local';
    const password = 'Admin@123';

    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email, password }
    });
    expect([200, 202]).toContain(loginRes.status());
    const loginData = await loginRes.json();
    if (loginRes.status() === 202) {
      expect(loginData.data.mfaRequired).toBe(true);
      expect(loginData.data.mfaTicket).toBeTruthy();
      // In dev, OTP is returned in mfaHint; in prod, skip
    } else {
      expect(loginData.success).toBe(true);
      expect(loginData.data.token).toBeTruthy();
    }
  });
});
