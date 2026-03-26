/**
 * Authentication Controller
 */

import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { isValidEmail, validatePassword, sanitizeInput } from '../utils/validators.js';
import { cleanupAuthAuditEvents, recordAuthAuditEvent } from '../utils/securityAudit.js';

const MFA_REQUIRED_ROLES = new Set(['admin', 'manager', 'supervisor']);
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const mfaChallengeStore = new Map();

const issueMfaChallenge = (user) => {
  const ticket = `mfa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS).toISOString();

  mfaChallengeStore.set(ticket, {
    ticket,
    code,
    expiresAt,
    accountId: user.AccountID,
    email: user.Email,
    role: user.Role,
    name: user.FullName,
  });

  return {
    ticket,
    code,
    expiresAt,
  };
};

const popMfaChallenge = (ticket) => {
  const challenge = mfaChallengeStore.get(ticket);
  if (!challenge) return null;

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    mfaChallengeStore.delete(ticket);
    return null;
  }

  mfaChallengeStore.delete(ticket);
  return challenge;
};

const getClientMeta = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const clientIp = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '').trim();
  return { clientIp, userAgent };
};

const auditAuthEvent = (req, payload) => {
  const { clientIp, userAgent } = getClientMeta(req);
  recordAuthAuditEvent({
    ...payload,
    clientIp,
    userAgent,
  }).catch(() => {});
};

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;

    // Validate input
    if (!email || !password || !name) {
      auditAuthEvent(req, {
        eventType: 'register',
        eventStatus: 'failed',
        email,
        reason: 'missing_required_fields',
      });
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name'
      });
    }

    if (!isValidEmail(email)) {
      auditAuthEvent(req, {
        eventType: 'register',
        eventStatus: 'failed',
        email,
        reason: 'invalid_email_format',
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      auditAuthEvent(req, {
        eventType: 'register',
        eventStatus: 'failed',
        email,
        reason: 'weak_password',
      });
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Check if user already exists
    const checkUserQuery = `SELECT AccountID FROM Accounts WHERE Email = @email`;
    const existingUser = await executeQuery(checkUserQuery, { email });

    if (existingUser.recordset.length > 0) {
      auditAuthEvent(req, {
        eventType: 'register',
        eventStatus: 'failed',
        email,
        reason: 'email_already_exists',
      });
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const insertQuery = `
      INSERT INTO Accounts (Email, Password, FullName, Role, CreatedDate)
      OUTPUT INSERTED.AccountID, INSERTED.Email, INSERTED.FullName, INSERTED.Role
      VALUES (@email, @password, @name, @role, GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      email: sanitizeInput(email),
      password: hashedPassword,
      name: sanitizeInput(name),
      role
    });

    const user = result.recordset[0];

    // Generate tokens
    const token = generateToken({
      id: user.AccountID,
      email: user.Email,
      role: user.Role
    });

    const refreshToken = generateRefreshToken({
      id: user.AccountID
    });

    auditAuthEvent(req, {
      eventType: 'register',
      eventStatus: 'success',
      email: user.Email,
      accountId: user.AccountID,
      reason: 'registered',
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.AccountID,
          email: user.Email,
          name: user.FullName,
          role: user.Role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    auditAuthEvent(req, {
      eventType: 'register',
      eventStatus: 'error',
      email: req.body?.email,
      reason: 'server_error',
    });
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      auditAuthEvent(req, {
        eventType: 'login',
        eventStatus: 'failed',
        email,
        reason: 'missing_required_fields',
      });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const query = `
      SELECT AccountID, Email, Password, FullName, Role 
      FROM Accounts 
      WHERE Email = @email AND IsActive = 1
    `;
    
    const result = await executeQuery(query, { email });

    if (result.recordset.length === 0) {
      auditAuthEvent(req, {
        eventType: 'login',
        eventStatus: 'failed',
        email,
        reason: 'invalid_credentials_user_not_found',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.recordset[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      auditAuthEvent(req, {
        eventType: 'login',
        eventStatus: 'failed',
        email,
        accountId: user.AccountID,
        reason: 'invalid_credentials_wrong_password',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (MFA_REQUIRED_ROLES.has(String(user.Role || '').toLowerCase())) {
      const challenge = issueMfaChallenge(user);

      auditAuthEvent(req, {
        eventType: 'login_mfa_challenge',
        eventStatus: 'success',
        email: user.Email,
        accountId: user.AccountID,
        reason: 'mfa_required_for_privileged_role',
      });

      return res.status(202).json({
        success: true,
        message: 'MFA verification required',
        data: {
          mfaRequired: true,
          mfaTicket: challenge.ticket,
          mfaExpiresAt: challenge.expiresAt,
          mfaHint: process.env.NODE_ENV === 'production'
            ? 'Use your authenticator code to continue.'
            : `Development OTP: ${challenge.code}`,
        },
      });
    }

    // Generate tokens
    const token = generateToken({
      id: user.AccountID,
      email: user.Email,
      role: user.Role
    });

    const refreshToken = generateRefreshToken({
      id: user.AccountID
    });

    auditAuthEvent(req, {
      eventType: 'login',
      eventStatus: 'success',
      email: user.Email,
      accountId: user.AccountID,
      reason: 'authenticated',
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.AccountID,
          email: user.Email,
          name: user.FullName,
          role: user.Role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    auditAuthEvent(req, {
      eventType: 'login',
      eventStatus: 'error',
      email: req.body?.email,
      reason: 'server_error',
    });
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * Verify MFA challenge and complete login
 * POST /api/auth/mfa/verify
 */
export const verifyMfa = async (req, res) => {
  try {
    const { mfaTicket, otpCode } = req.body || {};

    if (!mfaTicket || !otpCode) {
      auditAuthEvent(req, {
        eventType: 'login_mfa_verify',
        eventStatus: 'failed',
        reason: 'missing_ticket_or_code',
      });
      return res.status(400).json({
        success: false,
        message: 'mfaTicket and otpCode are required',
      });
    }

    const challenge = popMfaChallenge(String(mfaTicket));
    if (!challenge) {
      auditAuthEvent(req, {
        eventType: 'login_mfa_verify',
        eventStatus: 'failed',
        reason: 'ticket_invalid_or_expired',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired MFA ticket',
      });
    }

    if (String(challenge.code) !== String(otpCode).trim()) {
      auditAuthEvent(req, {
        eventType: 'login_mfa_verify',
        eventStatus: 'failed',
        email: challenge.email,
        accountId: challenge.accountId,
        reason: 'otp_mismatch',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP code',
      });
    }

    const token = generateToken({
      id: challenge.accountId,
      email: challenge.email,
      role: challenge.role,
    });

    const refreshToken = generateRefreshToken({
      id: challenge.accountId,
    });

    auditAuthEvent(req, {
      eventType: 'login_mfa_verify',
      eventStatus: 'success',
      email: challenge.email,
      accountId: challenge.accountId,
      reason: 'mfa_verified',
    });

    return res.json({
      success: true,
      message: 'MFA verification successful',
      data: {
        user: {
          id: challenge.accountId,
          email: challenge.email,
          name: challenge.name,
          role: challenge.role,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Verify MFA error:', error);
    auditAuthEvent(req, {
      eventType: 'login_mfa_verify',
      eventStatus: 'error',
      reason: 'server_error',
    });
    return res.status(500).json({
      success: false,
      message: 'Server error during MFA verification',
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      auditAuthEvent(req, {
        eventType: 'refresh_token',
        eventStatus: 'failed',
        reason: 'missing_refresh_token',
      });
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new access token
    const query = `
      SELECT AccountID, Email, Role 
      FROM Accounts 
      WHERE AccountID = @id AND IsActive = 1
    `;
    
    const result = await executeQuery(query, { id: decoded.id });

    if (result.recordset.length === 0) {
      auditAuthEvent(req, {
        eventType: 'refresh_token',
        eventStatus: 'failed',
        accountId: decoded.id,
        reason: 'invalid_refresh_token_user_not_found',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = result.recordset[0];

    const newToken = generateToken({
      id: user.AccountID,
      email: user.Email,
      role: user.Role
    });

    auditAuthEvent(req, {
      eventType: 'refresh_token',
      eventStatus: 'success',
      email: user.Email,
      accountId: user.AccountID,
      reason: 'token_refreshed',
    });

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    auditAuthEvent(req, {
      eventType: 'refresh_token',
      eventStatus: 'error',
      reason: 'invalid_or_expired_refresh_token',
    });
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    const query = `
      SELECT AccountID, Email, FullName, Role, PhoneNumber, CreatedDate
      FROM Accounts 
      WHERE AccountID = @id AND IsActive = 1
    `;
    
    const result = await executeQuery(query, { id: req.user.id });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.recordset[0];

    res.json({
      success: true,
      data: {
        id: user.AccountID,
        email: user.Email,
        name: user.FullName,
        role: user.Role,
        phone: user.PhoneNumber,
        createdDate: user.CreatedDate
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get security audit events (admin only)
 * GET /api/auth/security-audit
 */
export const getSecurityAudit = async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '100'), 10) || 100));
    const eventType = String(req.query.eventType || '').trim();
    const eventStatus = String(req.query.eventStatus || '').trim();
    const format = String(req.query.format || 'json').trim().toLowerCase();

    const result = await executeQuery(
      `
      IF OBJECT_ID('dbo.SecurityAuthAudit', 'U') IS NULL
      BEGIN
        SELECT TOP 0
          CAST(NULL AS INT) AS AuditId,
          CAST(NULL AS NVARCHAR(80)) AS EventType,
          CAST(NULL AS NVARCHAR(32)) AS EventStatus,
          CAST(NULL AS NVARCHAR(255)) AS Email,
          CAST(NULL AS INT) AS AccountId,
          CAST(NULL AS NVARCHAR(255)) AS Reason,
          CAST(NULL AS NVARCHAR(120)) AS ClientIp,
          CAST(NULL AS NVARCHAR(512)) AS UserAgent,
          CAST(NULL AS DATETIME2) AS CreatedAt;
      END
      ELSE
      BEGIN
        SELECT TOP (@limit)
          AuditId,
          EventType,
          EventStatus,
          Email,
          AccountId,
          Reason,
          ClientIp,
          UserAgent,
          CreatedAt
        FROM dbo.SecurityAuthAudit
        WHERE (@eventType = '' OR EventType = @eventType)
          AND (@eventStatus = '' OR EventStatus = @eventStatus)
        ORDER BY CreatedAt DESC;
      END
      `,
      {
        limit,
        eventType,
        eventStatus,
      }
    );

    const rows = result.recordset || [];

    if (format === 'csv') {
      const header = ['AuditId', 'EventType', 'EventStatus', 'Email', 'AccountId', 'Reason', 'ClientIp', 'UserAgent', 'CreatedAt'];
      const csvLines = [header.join(',')];

      rows.forEach((row) => {
        const values = header.map((key) => {
          const raw = row[key] == null ? '' : String(row[key]);
          return `"${raw.replace(/"/g, '""')}"`;
        });
        csvLines.push(values.join(','));
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="security-auth-audit.csv"');
      return res.status(200).send(csvLines.join('\n'));
    }

    return res.json({
      success: true,
      data: rows,
      metadata: {
        limit,
        count: rows.length,
        filters: {
          eventType: eventType || null,
          eventStatus: eventStatus || null,
        },
      },
    });
  } catch (error) {
    console.error('Get security audit error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving security audit log',
    });
  }
};

/**
 * Cleanup security audit rows older than retention window (admin only)
 * POST /api/auth/security-audit/cleanup
 */
export const cleanupSecurityAudit = async (req, res) => {
  try {
    const retentionDays = Number.parseInt(String(req.body?.retentionDays || process.env.SECURITY_AUDIT_RETENTION_DAYS || '90'), 10);
    const result = await cleanupAuthAuditEvents(retentionDays);

    return res.json({
      success: true,
      message: 'Security audit cleanup completed',
      data: result,
    });
  } catch (error) {
    console.error('Cleanup security audit error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while cleaning security audit log',
    });
  }
};

/**
 * GDPR-style export of account profile by account ID (admin only)
 * GET /api/auth/privacy/export/:accountId
 */
export const exportPrivacyData = async (req, res) => {
  try {
    const accountId = Number.parseInt(String(req.params.accountId || ''), 10);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID',
      });
    }

    const accountResult = await executeQuery(
      `
      SELECT TOP 1
        AccountID,
        Email,
        FullName,
        Role,
        PhoneNumber,
        IsActive,
        CreatedDate
      FROM Accounts
      WHERE AccountID = @accountId
      `,
      { accountId }
    );

    if (!accountResult.recordset.length) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    const account = accountResult.recordset[0];

    const auditResult = await executeQuery(
      `
      IF OBJECT_ID('dbo.SecurityAuthAudit', 'U') IS NULL
      BEGIN
        SELECT TOP 0 AuditId, EventType, EventStatus, Email, AccountId, Reason, ClientIp, UserAgent, CreatedAt
      END
      ELSE
      BEGIN
        SELECT TOP 200 AuditId, EventType, EventStatus, Email, AccountId, Reason, ClientIp, UserAgent, CreatedAt
        FROM dbo.SecurityAuthAudit
        WHERE AccountId = @accountId
        ORDER BY CreatedAt DESC;
      END
      `,
      { accountId }
    );

    return res.json({
      success: true,
      data: {
        account,
        securityAudit: auditResult.recordset || [],
      },
      metadata: {
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Export privacy data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while exporting privacy data',
    });
  }
};

/**
 * GDPR-style anonymize/deactivate account by account ID (admin only)
 * POST /api/auth/privacy/anonymize/:accountId
 */
export const anonymizePrivacyData = async (req, res) => {
  try {
    const accountId = Number.parseInt(String(req.params.accountId || ''), 10);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID',
      });
    }

    const randomPasswordSeed = `disabled-${Date.now()}-${Math.random()}`;
    const replacementPassword = await bcrypt.hash(randomPasswordSeed, 10);

    const result = await executeQuery(
      `
      UPDATE Accounts
      SET
        Email = CONCAT('anonymized+', CAST(AccountID AS NVARCHAR(20)), '@redacted.local'),
        FullName = 'Anonymized User',
        PhoneNumber = NULL,
        Password = @replacementPassword,
        IsActive = 0
      OUTPUT INSERTED.AccountID, INSERTED.Email, INSERTED.FullName, INSERTED.IsActive
      WHERE AccountID = @accountId
      `,
      {
        accountId,
        replacementPassword,
      }
    );

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    const updated = result.recordset[0];

    return res.json({
      success: true,
      message: 'Account anonymized successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Anonymize privacy data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while anonymizing privacy data',
    });
  }
};

export default {
  register,
  login,
  refreshToken,
  verifyMfa,
  getMe,
  getSecurityAudit,
  cleanupSecurityAudit,
  exportPrivacyData,
  anonymizePrivacyData,
};
