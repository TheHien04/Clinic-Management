/**
 * Optional CSRF protection using double-submit cookie strategy.
 * Disabled by default to preserve current API behavior.
 */

import crypto from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const isEnabled = () => String(process.env.ENABLE_CSRF_TOKEN || 'false').toLowerCase() === 'true';

const getCookieName = () => String(process.env.CSRF_COOKIE_NAME || 'csrf_token').trim();

const getMaxAgeMs = () => {
  const parsed = Number.parseInt(String(process.env.CSRF_TOKEN_MAX_AGE_MS || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2 * 60 * 60 * 1000;
};

export const issueCsrfToken = (req, res) => {
  if (!isEnabled()) {
    return res.json({
      success: true,
      data: {
        enabled: false,
        csrfToken: null,
      },
      message: 'CSRF token protection is disabled.',
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const cookieName = getCookieName();
  const maxAge = getMaxAgeMs();

  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  });

  return res.json({
    success: true,
    data: {
      enabled: true,
      csrfToken: token,
      expiresInMs: maxAge,
    },
  });
};

export const csrfProtection = (req, res, next) => {
  if (!isEnabled()) {
    return next();
  }

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieName = getCookieName();
  const cookieToken = req.cookies?.[cookieName];
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token validation failed.',
    });
  }

  return next();
};

export default {
  issueCsrfToken,
  csrfProtection,
};
