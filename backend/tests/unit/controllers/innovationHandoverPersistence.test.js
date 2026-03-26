import { describe, it, expect, vi } from 'vitest';

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('innovation handover persistence degradation behavior', () => {
  it('returns 503 for handover history when persistence is unavailable', async () => {
    vi.resetModules();

    vi.doMock('../../../src/config/database.js', () => ({
      executeQuery: vi.fn().mockRejectedValue(new Error('db offline')),
    }));

    const { getOperationsHandover } = await import('../../../src/controllers/innovationController.js');

    const req = {
      query: {},
      user: { email: 'manager@clinic.com', role: 'manager' },
    };
    const res = createRes();

    await getOperationsHandover(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('temporarily unavailable'),
    }));
  });

  it('returns 503 for handover save when persistence is unavailable', async () => {
    vi.resetModules();

    vi.doMock('../../../src/config/database.js', () => ({
      executeQuery: vi.fn().mockRejectedValue(new Error('db offline')),
    }));

    const { postOperationsHandover } = await import('../../../src/controllers/innovationController.js');

    const req = {
      body: {
        situation: 'ED overflow during night shift',
        background: 'High inflow from emergency triage',
        assessment: 'Nurse coverage below threshold',
        recommendation: 'Activate on-call backup roster',
      },
      user: { email: 'admin@clinic.com', role: 'admin' },
    };
    const res = createRes();

    await postOperationsHandover(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('persistence is degraded'),
    }));
  });
});
