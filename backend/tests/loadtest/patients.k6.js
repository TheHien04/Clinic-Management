// K6 load test script for patient creation API
// Run with: k6 run backend/tests/loadtest/patients.k6.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
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
    throw new Error('MFA required for load test user. Use a non-MFA account.');
  }
  const loginData = loginRes.json();
  token = loginData.data.token;
  return { token };
}

export default function (data) {
  // Create patient
  const payload = JSON.stringify({
    fullname: `LoadTest Patient ${Math.random().toString(36).slice(2,8)}`,
    dateOfBirth: '1990-01-01',
    gender: 'M',
    phone: '0912345678',
    email: `loadtest_${Math.random().toString(36).slice(2,8)}@test.com`,
    address: '123 Test St',
    username: `loadtest_${Math.random().toString(36).slice(2,8)}`,
    password: 'Password123!'
  });
  const res = http.post(`${BASE_URL}/api/patients`, payload, {
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
