import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeQueryMock = vi.fn();
const compareMock = vi.fn();
const hashMock = vi.fn();

vi.mock('../../../src/config/database.js', () => ({
  executeQuery: executeQueryMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: compareMock,
    hash: hashMock,
  },
}));

const { login, refreshToken, register, verifyMfa } = await import('../../../src/controllers/authController.js');
const { generateRefreshToken } = await import('../../../src/utils/jwt.js');

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('auth controller MFA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns MFA challenge for privileged role login', async () => {
    executeQueryMock.mockResolvedValue({
      recordset: [
        {
          AccountID: 11,
          Email: 'admin@clinic.com',
          Password: 'hashed-password',
          FullName: 'Admin One',
          Role: 'admin',
        },
      ],
    });
    compareMock.mockResolvedValue(true);

    const req = {
      body: { email: 'admin@clinic.com', password: '123456' },
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = createRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.mfaRequired).toBe(true);
    expect(payload.data.mfaTicket).toContain('mfa-');
    expect(payload.data.mfaHint).toContain('Development OTP:');
  });

  it('never accepts a privileged role from public registration', async () => {
    hashMock.mockResolvedValue('hashed-password');
    executeQueryMock.mockImplementation(async (query) => {
      if (String(query).includes('SELECT AccountID FROM Accounts')) {
        return { recordset: [] };
      }
      if (String(query).includes('INSERT INTO Accounts')) {
        return {
          recordset: [{
            AccountID: 42,
            Email: 'patient@clinic.com',
            FullName: 'Patient One',
            Role: 'patient',
          }],
        };
      }
      return { recordset: [] };
    });

    const req = {
      body: {
        email: 'patient@clinic.com',
        password: 'Clinic123',
        name: 'Patient One',
        role: 'admin',
      },
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = createRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.user.role).toBe('patient');
    expect(executeQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO Accounts'),
      expect.objectContaining({ role: 'patient' }),
    );
  });

  it('verifies MFA code and returns tokens', async () => {
    executeQueryMock.mockResolvedValue({
      recordset: [
        {
          AccountID: 11,
          Email: 'admin@clinic.com',
          Password: 'hashed-password',
          FullName: 'Admin One',
          Role: 'admin',
        },
      ],
    });
    compareMock.mockResolvedValue(true);

    const loginReq = {
      body: { email: 'admin@clinic.com', password: '123456' },
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const loginRes = createRes();

    await login(loginReq, loginRes);
    const challengePayload = loginRes.json.mock.calls[0][0];
    const code = String(challengePayload.data.mfaHint).replace('Development OTP:', '').trim();

    const verifyReq = {
      body: {
        mfaTicket: challengePayload.data.mfaTicket,
        otpCode: code,
      },
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const verifyRes = createRes();

    await verifyMfa(verifyReq, verifyRes);

    const verifyPayload = verifyRes.json.mock.calls[0][0];
    expect(verifyPayload.success).toBe(true);
    expect(verifyPayload.data.user.email).toBe('admin@clinic.com');
    expect(verifyPayload.data.token).toBeTruthy();
    expect(verifyPayload.data.refreshToken).toBeUndefined();
    expect(verifyRes.cookie).toHaveBeenCalledWith(
      'clinic_refresh_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });

  it('accepts refresh credentials only from the HttpOnly cookie and rotates them', async () => {
    executeQueryMock.mockResolvedValue({
      recordset: [{
        AccountID: 18,
        Email: 'doctor@clinic.com',
        Role: 'doctor',
        ClinicID: 2,
      }],
    });
    const currentRefreshToken = generateRefreshToken({ id: 18 });
    const req = {
      body: { refreshToken: 'must-not-be-used' },
      cookies: { clinic_refresh_token: currentRefreshToken },
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = createRes();

    await refreshToken(req, res);

    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith(
      'clinic_refresh_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(res.cookie.mock.calls[0][1]).not.toBe(currentRefreshToken);
  });

  it('rejects a refresh token supplied only in the request body', async () => {
    const req = {
      body: { refreshToken: generateRefreshToken({ id: 18 }) },
      cookies: {},
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = createRes();

    await refreshToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(executeQueryMock).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM Accounts'),
      expect.anything(),
    );
  });
});
