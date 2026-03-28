// E2E test for appointment booking flow using Playwright Test
// Run with: npx playwright test backend/tests/e2e/appointments.e2e.test.js

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';

test.describe('Appointment E2E', () => {
  let token;
  let patientId;
  let doctorId;
  let appointmentId;

  test.beforeAll(async ({ request }) => {
    // Register and login a test user
    const email = `apptuser_${Date.now()}@test.com`;
    const password = 'Password123!';
    const name = 'E2E Appt User';
    await request.post(`${BASE_URL}/api/auth/register`, { data: { email, password, name } });
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
    const loginData = await loginRes.json();
    token = loginData.data.token;
  });

  test('Create, get, update, and delete appointment', async ({ request }) => {
    // Get a doctor and patient (assume seeded data)
    const doctorsRes = await request.get(`${BASE_URL}/api/doctors`, { headers: { Authorization: `Bearer ${token}` } });
    const doctors = (await doctorsRes.json()).data;
    doctorId = doctors[0]?.id || 1;
    const patientsRes = await request.get(`${BASE_URL}/api/patients`, { headers: { Authorization: `Bearer ${token}` } });
    const patients = (await patientsRes.json()).data;
    patientId = patients[0]?.id || 1;

    // Create appointment
    const apptRes = await request.post(`${BASE_URL}/api/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        patientId,
        doctorId,
        appointmentDate: '2026-04-01',
        appointmentTime: '10:00:00',
        notes: 'E2E test appointment'
      }
    });
    expect(apptRes.status()).toBe(201);
    const apptData = await apptRes.json();
    appointmentId = apptData.data.id;

    // Get appointment
    const getRes = await request.get(`${BASE_URL}/api/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(getRes.status()).toBe(200);
    const getData = await getRes.json();
    expect(getData.data.id).toBe(appointmentId);

    // Update appointment
    const updateRes = await request.put(`${BASE_URL}/api/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { notes: 'Updated by E2E' }
    });
    expect(updateRes.status()).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.data.notes).toBe('Updated by E2E');

    // Delete appointment
    const delRes = await request.delete(`${BASE_URL}/api/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(delRes.status()).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);
  });
});
