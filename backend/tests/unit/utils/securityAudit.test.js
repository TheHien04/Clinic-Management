import { describe, it, expect, vi } from 'vitest';

describe('security audit utils', () => {
  it('persists auth audit events via ensure-table + insert flow', async () => {
    vi.resetModules();

    const executeQuery = vi.fn().mockResolvedValue({ recordset: [] });
    vi.doMock('../../../src/config/database.js', () => ({ executeQuery }));

    const { recordAuthAuditEvent } = await import('../../../src/utils/securityAudit.js');

    await recordAuthAuditEvent({
      eventType: 'login',
      eventStatus: 'success',
      email: 'doctor@clinic.com',
      accountId: 5,
      reason: 'authenticated',
      clientIp: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(executeQuery).toHaveBeenCalledTimes(2);
    expect(String(executeQuery.mock.calls[0][0])).toContain('SecurityAuthAudit');
    expect(String(executeQuery.mock.calls[1][0])).toContain('INSERT INTO dbo.SecurityAuthAudit');
  });

  it('does not throw when audit persistence fails', async () => {
    vi.resetModules();

    const executeQuery = vi
      .fn()
      .mockResolvedValueOnce({ recordset: [] })
      .mockRejectedValueOnce(new Error('db unavailable'));

    vi.doMock('../../../src/config/database.js', () => ({ executeQuery }));

    const { recordAuthAuditEvent } = await import('../../../src/utils/securityAudit.js');

    await expect(recordAuthAuditEvent({
      eventType: 'refresh_token',
      eventStatus: 'error',
      reason: 'db_failure_test',
    })).resolves.toBeUndefined();
  });
});
