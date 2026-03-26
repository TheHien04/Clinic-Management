import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeQueryMock = vi.fn();
const compareMock = vi.fn();

vi.mock('../../../src/config/database.js', () => ({
  executeQuery: executeQueryMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: compareMock,
    hash: vi.fn(),
  },
}));

const { login, verifyMfa } = await import('../../../src/controllers/authController.js');

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
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
    expect(verifyPayload.data.refreshToken).toBeTruthy();
  });
});
