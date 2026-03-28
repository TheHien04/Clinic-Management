// E2E test for patient management flow using Playwright Test
// Run with: npx playwright test backend/tests/e2e/patient.e2e.test.js

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';

test.describe('Patient Management E2E', () => {
  let token;
  let patientId;

  test.beforeAll(async ({ request }) => {
    // Register and login a test user
    const email = `patientuser_${Date.now()}@test.com`;
    const password = 'Password123!';
    const name = 'E2E Patient User';
    await request.post(`${BASE_URL}/api/auth/register`, { data: { email, password, name } });
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
    const loginData = await loginRes.json();
    token = loginData.data.token;
  });

  test('Create, get, update, and delete patient', async ({ request }) => {
    // Create patient
    const createRes = await request.post(`${BASE_URL}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        fullname: 'E2E Patient',
        dateOfBirth: '1990-01-01',
        gender: 'M',
        phone: '0912345678',
        email: `e2epatient_${Date.now()}@test.com`,
        address: '123 Test St',
        username: `e2epatient_${Date.now()}`,
        password: 'Password123!'
      }
    });
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    patientId = createData.data.id;

    // Get patient
    const getRes = await request.get(`${BASE_URL}/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(getRes.status()).toBe(200);
    const getData = await getRes.json();
    expect(getData.data.id).toBe(patientId);

    // Update patient
    const updateRes = await request.put(`${BASE_URL}/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { address: 'Updated by E2E' }
    });
    expect(updateRes.status()).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.data.address).toBe('Updated by E2E');

    // Delete patient
    const delRes = await request.delete(`${BASE_URL}/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(delRes.status()).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);
  });
});
