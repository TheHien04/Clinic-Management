import { spawn } from 'child_process';
import process from 'process';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5055';
const API_BASE_URL = `${BASE_URL}/api`;
const HEALTH_TIMEOUT_MS = 60000;
const HEALTH_RETRY_MS = 1000;

const randomSuffix = Date.now().toString(36);
const registerPayload = {
  email: `smoke_patient_${randomSuffix}@example.com`,
  name: `Smoke Patient ${randomSuffix}`,
  password: 'SmokePass123!',
  // Deliberately hostile input: public registration must ignore this value.
  role: 'admin',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isHealthy = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
};

const ensureOk = async (res, label) => {
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errorText = body ? JSON.stringify(body) : `<non-json status=${res.status}>`;
    throw new Error(`${label} failed with status ${res.status}: ${errorText}`);
  }

  return body;
};

const tryParseJson = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const waitForHealth = async () => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    if (await isHealthy()) {
      return;
    }

    await sleep(HEALTH_RETRY_MS);
  }

  throw new Error('Timed out waiting for /api/health');
};

const runFlow = async () => {
  const registrationBody = await ensureOk(
    await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    }),
    'auth/register',
  );

  if (registrationBody?.data?.user?.role !== 'patient') {
    throw new Error('Public registration was able to request a privileged role');
  }

  const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SMOKE_ADMIN_EMAIL || 'admin@clinic.local',
      password: process.env.SMOKE_ADMIN_PASSWORD || 'Admin@123',
    }),
  });
  const loginBody = await ensureOk(loginResponse, 'auth/login');

  let accessToken = loginBody?.data?.token;
  let refreshCookie = loginResponse.headers.get('set-cookie') || '';

  if (loginBody?.data?.mfaRequired && loginBody?.data?.mfaTicket) {
    const otpCode = String(loginBody?.data?.mfaHint || '').replace('Development OTP:', '').trim();

    if (!otpCode) {
      throw new Error('MFA challenge returned without usable OTP hint in smoke test mode');
    }

    const verifyResponse = await fetch(`${API_BASE_URL}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: loginBody.data.mfaTicket,
        otpCode,
      }),
    });
    const verifyBody = await ensureOk(verifyResponse, 'auth/mfa/verify');

    accessToken = verifyBody?.data?.token;
    refreshCookie = verifyResponse.headers.get('set-cookie') || '';
  }

  if (!accessToken || !refreshCookie) {
    throw new Error('Missing access token or secure refresh cookie after login');
  }

  await ensureOk(
    await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: refreshCookie.split(';')[0] },
    }),
    'auth/refresh',
  );

  const reportsBody = await ensureOk(
    await fetch(`${API_BASE_URL}/reports/analytics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'reports/analytics',
  );

  if (reportsBody?.data?.source !== 'database') {
    throw new Error(`Unexpected reports source: ${reportsBody?.data?.source}`);
  }

  const staffBody = await ensureOk(
    await fetch(`${API_BASE_URL}/staff`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'staff list',
  );

  if (!Array.isArray(staffBody?.data)) {
    throw new Error('Staff list response is not an array');
  }

  // Exercise a complete governed care workflow with a privileged actor. The
  // legacy E2E files previously attempted these writes with a patient token,
  // which correctly fails RBAC and therefore never represented a valid flow.
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const doctorsBody = await ensureOk(
    await fetch(`${API_BASE_URL}/doctors?limit=1`, { headers: authHeaders }),
    'doctors list',
  );
  const doctorId = Number(doctorsBody?.data?.[0]?.DoctorID || doctorsBody?.data?.[0]?.id || 0);
  if (!doctorId) {
    throw new Error('Expected at least one seeded doctor for care-workflow smoke test');
  }

  const patientBody = await ensureOk(
    await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Smoke Care Patient ${randomSuffix}`,
        dateOfBirth: '1990-01-01',
        gender: 'other',
        phoneNumber: `09${String(Date.now()).slice(-8)}`,
        email: `smoke_care_${randomSuffix}@example.com`,
        address: 'Synthetic test address',
        medicalHistory: 'Synthetic smoke-test record; not a real patient',
      }),
    }),
    'patients create',
  );
  const patientId = Number(patientBody?.data?.PatientID || patientBody?.data?.id || 0);
  if (!patientId) {
    throw new Error('Patient create response did not include an identifier');
  }

  const appointmentDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const now = Date.now();
  const appointmentTime = `17:${String(Math.floor(now / 1000) % 60).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`;
  const appointmentBody = await ensureOk(
    await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        doctorId,
        appointmentDate,
        appointmentTime,
        notes: 'Synthetic end-to-end care workflow',
      }),
    }),
    'appointments create',
  );
  const appointmentId = Number(appointmentBody?.data?.AppointmentID || appointmentBody?.data?.id || 0);
  if (!appointmentId) {
    throw new Error('Appointment create response did not include an identifier');
  }

  await ensureOk(
    await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, { headers: authHeaders }),
    'appointments get',
  );
  await ensureOk(
    await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed', notes: 'Smoke workflow confirmed' }),
    }),
    'appointments update',
  );
  await ensureOk(
    await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
      method: 'DELETE',
      headers: authHeaders,
    }),
    'appointments delete',
  );
  await ensureOk(
    await fetch(`${API_BASE_URL}/patients/${patientId}`, {
      method: 'DELETE',
      headers: authHeaders,
    }),
    'patients delete',
  );

  const postureBody = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/security/posture`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'innovation/security/posture',
  );

  if (!postureBody?.data?.posture) {
    throw new Error('Expected innovation/security/posture to return posture data');
  }

  const triageBody = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/ai/triage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        age: 68,
        symptoms: 'shortness of breath and chest pain',
        vitals: {
          heartRate: 132,
          spo2: 90,
          temperature: 38.4,
          systolic: 168,
        },
      }),
    }),
    'innovation/ai/triage',
  );

  const decisionPackage = triageBody?.data?.decisionPackage;
  if (!decisionPackage?.packageId || !decisionPackage?.signature || !decisionPackage?.digest) {
    throw new Error('Expected innovation/ai/triage to return signed decision package');
  }

  const verifyBody = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/ai-triage/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ decisionPackage }),
    }),
    'innovation/ai-triage/verify',
  );

  if (!verifyBody?.data?.valid) {
    throw new Error('Expected innovation/ai-triage/verify to validate fresh package');
  }

  const signingKeysBefore = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/ai-triage/signing-keys`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'innovation/ai-triage/signing-keys (before rotate)',
  );

  const beforeActiveKeyId = String(signingKeysBefore?.data?.activeKeyId || '');
  if (!beforeActiveKeyId) {
    throw new Error('Expected active signing key ID before rotate');
  }

  const rotateBody = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/ai-triage/signing-keys/rotate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'innovation/ai-triage/signing-keys/rotate',
  );

  const rotatedKeyId = String(rotateBody?.data?.activeKeyId || '');
  if (!rotatedKeyId) {
    throw new Error('Expected active signing key ID after rotate');
  }

  const signingKeysAfter = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/ai-triage/signing-keys`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'innovation/ai-triage/signing-keys (after rotate)',
  );

  const afterActiveKeyId = String(signingKeysAfter?.data?.activeKeyId || '');
  if (afterActiveKeyId !== rotatedKeyId) {
    throw new Error('Expected signing-keys endpoint to reflect rotated active key');
  }

  const evidenceBody = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/compliance/evidence`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'innovation/compliance/evidence',
  );

  if (!evidenceBody?.data?.integrityHash) {
    throw new Error('Expected innovation/compliance/evidence to include integrityHash');
  }

  const cleanupBody = await ensureOk(
    await fetch(`${API_BASE_URL}/innovation/maintenance/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        revokedRetentionDays: 90,
        auditKeep: 500,
      }),
    }),
    'innovation/maintenance/cleanup',
  );

  if (!cleanupBody?.data?.cleanedAt) {
    throw new Error('Expected innovation/maintenance/cleanup to return cleanedAt timestamp');
  }

  // Pick a run-unique future month/year and retry on duplicate period conflicts.
  const seed = Number.parseInt(randomSuffix.slice(-6), 36);
  const baseMonth = (seed % 12) + 1;
  const baseYear = 3000 + (seed % 1000);
  let payrollMonth = baseMonth;
  let payrollYear = baseYear;
  let payrollCalcBody = null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const monthOffset = (baseMonth - 1 + attempt) % 12;
    const yearOffset = Math.floor((baseMonth - 1 + attempt) / 12);
    payrollMonth = monthOffset + 1;
    payrollYear = baseYear + yearOffset;

    const calcRes = await fetch(`${API_BASE_URL}/salaries/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        month: payrollMonth,
        year: payrollYear,
      }),
    });

    if (calcRes.ok) {
      payrollCalcBody = await tryParseJson(calcRes);
      break;
    }

    const errorBody = await tryParseJson(calcRes);
    const msg = String(errorBody?.message || '');
    const duplicatePeriod = calcRes.status === 400 && msg.toLowerCase().includes('already calculated');
    if (duplicatePeriod) {
      continue;
    }

    const errorText = errorBody ? JSON.stringify(errorBody) : `<non-json status=${calcRes.status}>`;
    throw new Error(`salaries/calculate failed with status ${calcRes.status}: ${errorText}`);
  }

  if (!payrollCalcBody) {
    throw new Error('Unable to find a free payroll period for smoke test after 24 attempts');
  }

  const calculatedRecords = Number(payrollCalcBody?.data?.totalRecords || 0);
  if (calculatedRecords <= 0) {
    throw new Error(`Expected salaries/calculate to create records, got totalRecords=${calculatedRecords}`);
  }

  const payrollSummaryBody = await ensureOk(
    await fetch(`${API_BASE_URL}/salaries/summary?month=${payrollMonth}&year=${payrollYear}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    'salaries/summary',
  );

  if (!Array.isArray(payrollSummaryBody?.data) || payrollSummaryBody.data.length === 0) {
    throw new Error('Expected salaries/summary to return at least one aggregated row');
  }

  const summaryTotalEmployees = payrollSummaryBody.data.reduce(
    (sum, row) => sum + Number(row?.employee_count || 0),
    0,
  );

  if (summaryTotalEmployees <= 0) {
    throw new Error('Expected salaries/summary employee_count aggregation to be > 0');
  }
};

const main = async () => {
  const reuseExistingServer = await isHealthy();
  const server = reuseExistingServer
    ? null
    : spawn('node', ['src/server.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'test',
        PORT: process.env.PORT || '5055',
        PORT_FALLBACK_ATTEMPTS: '1',
      },
      stdio: 'inherit',
    });

  const stopServer = () => {
    if (server && !server.killed) {
      server.kill('SIGINT');
    }
  };

  process.on('SIGINT', stopServer);
  process.on('SIGTERM', stopServer);

  try {
    await waitForHealth();
    await runFlow();
    console.log('Smoke test passed.');
  } finally {
    stopServer();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
