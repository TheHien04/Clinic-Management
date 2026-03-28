// K6 load test script for appointment booking API
// Run with: k6 run backend/tests/loadtest/appointments.k6.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp up to 10 users
    { duration: '1m', target: 50 },  // spike to 50 users
    { duration: '2m', target: 100 }, // sustain 100 users
    { duration: '30s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],   // <1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const USERNAME = __ENV.USERNAME || 'admin@clinic.local';
const PASSWORD = __ENV.PASSWORD || 'Admin@123';

let token = '';

export function setup() {
  // Login and get token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email: USERNAME, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (loginRes.status === 202) {
    // MFA required, skip for load test
    throw new Error('MFA required for load test user. Use a non-MFA account.');
  }
  const loginData = loginRes.json();
  token = loginData.data.token;
  return { token };
}

export default function (data) {
  // Book appointment
  const payload = JSON.stringify({
    patientId: 1,
    doctorId: 1,
    appointmentDate: '2026-04-01',
    appointmentTime: '10:00:00',
    notes: 'Load test appointment',
  });
  const res = http.post(`${BASE_URL}/api/appointments`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  });
  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
