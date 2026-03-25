/**
 * Security audit utility for auth-sensitive events.
 * Persists to SQL Server when available; never throws to caller.
 */

import { executeQuery } from '../config/database.js';

let tableReady = false;
let retentionTimer = null;

const trimValue = (value, maxLen = 255) => String(value || '').trim().slice(0, maxLen);

const ensureSecurityAuditTable = async () => {
  if (tableReady) return;

  await executeQuery(`
    IF OBJECT_ID('dbo.SecurityAuthAudit', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SecurityAuthAudit (
        AuditId INT IDENTITY(1,1) PRIMARY KEY,
        EventType NVARCHAR(80) NOT NULL,
        EventStatus NVARCHAR(32) NOT NULL,
        Email NVARCHAR(255) NULL,
        AccountId INT NULL,
        Reason NVARCHAR(255) NULL,
        ClientIp NVARCHAR(120) NULL,
        UserAgent NVARCHAR(512) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );

      CREATE INDEX IX_SecurityAuthAudit_CreatedAt ON dbo.SecurityAuthAudit (CreatedAt DESC);
      CREATE INDEX IX_SecurityAuthAudit_EventType ON dbo.SecurityAuthAudit (EventType, CreatedAt DESC);
    END
  `);

  tableReady = true;
};

export const recordAuthAuditEvent = async ({
  eventType,
  eventStatus,
  email,
  accountId,
  reason,
  clientIp,
  userAgent,
}) => {
  try {
    await ensureSecurityAuditTable();

    await executeQuery(
      `
      INSERT INTO dbo.SecurityAuthAudit
        (EventType, EventStatus, Email, AccountId, Reason, ClientIp, UserAgent)
      VALUES
        (@eventType, @eventStatus, @email, @accountId, @reason, @clientIp, @userAgent)
      `,
      {
        eventType: trimValue(eventType, 80),
        eventStatus: trimValue(eventStatus, 32) || 'unknown',
        email: trimValue(email, 255) || null,
        accountId: Number.isFinite(Number(accountId)) ? Number(accountId) : null,
        reason: trimValue(reason, 255) || null,
        clientIp: trimValue(clientIp, 120) || null,
        userAgent: trimValue(userAgent, 512) || null,
      }
    );
  } catch (error) {
    // Keep auth flow resilient even when audit persistence is unavailable.
    console.warn('Security audit write failed:', error.message);
  }
};

export const cleanupAuthAuditEvents = async (retentionDays = Number(process.env.SECURITY_AUDIT_RETENTION_DAYS || 90)) => {
  const safeRetentionDays = Math.min(3650, Math.max(1, Number.parseInt(String(retentionDays), 10) || 90));

  await ensureSecurityAuditTable();

  const result = await executeQuery(
    `
    DELETE FROM dbo.SecurityAuthAudit
    WHERE CreatedAt < DATEADD(DAY, -@retentionDays, SYSUTCDATETIME());

    SELECT @@ROWCOUNT AS removedCount;
    `,
    { retentionDays: safeRetentionDays }
  );

  return {
    retentionDays: safeRetentionDays,
    removedCount: Number(result.recordset?.[0]?.removedCount || 0),
  };
};

export const startSecurityAuditRetentionJob = () => {
  const enabled = String(process.env.SECURITY_AUDIT_RETENTION_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) return null;

  const intervalMs = Math.max(60_000, Number.parseInt(String(process.env.SECURITY_AUDIT_RETENTION_INTERVAL_MS || 86_400_000), 10) || 86_400_000);

  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }

  // Run once shortly after startup.
  setTimeout(() => {
    cleanupAuthAuditEvents().catch((error) => {
      console.warn('Security audit retention initial run failed:', error.message);
    });
  }, 2000);

  retentionTimer = setInterval(() => {
    cleanupAuthAuditEvents().catch((error) => {
      console.warn('Security audit retention run failed:', error.message);
    });
  }, intervalMs);

  return retentionTimer;
};

export const stopSecurityAuditRetentionJob = () => {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
};

export default {
  recordAuthAuditEvent,
  cleanupAuthAuditEvents,
  startSecurityAuditRetentionJob,
  stopSecurityAuditRetentionJob,
};
