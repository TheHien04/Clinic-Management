/**
 * Request origin guard for state-changing methods.
 * Useful as CSRF-style protection for browser-based clients.
 */

import { getAllowedOrigins } from '../config/env.js';

const STATE_CHANGE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isStrictOriginCheckEnabled = () => String(process.env.STRICT_ORIGIN_CHECK || 'false').toLowerCase() === 'true';

const normalizeOrigin = (value) => {
  try {
    if (!value) return '';
    return new URL(String(value).trim()).origin;
  } catch {
    return '';
  }
};

const parseHeaderOrigin = (req) => {
  const originHeader = String(req.headers.origin || '').trim();
  if (originHeader) return normalizeOrigin(originHeader);

  const refererHeader = String(req.headers.referer || '').trim();
  if (refererHeader) return normalizeOrigin(refererHeader);

  return '';
};

export const stateChangeOriginGuard = (req, res, next) => {
  if (!STATE_CHANGE_METHODS.has(req.method)) {
    return next();
  }

  if (!isStrictOriginCheckEnabled()) {
    return next();
  }

  const requestOrigin = parseHeaderOrigin(req);

  // Non-browser clients may not send Origin/Referer.
  if (!requestOrigin) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins('CORS_ORIGIN');
  const normalizedAllowed = new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean));

  if (!normalizedAllowed.has(requestOrigin)) {
    return res.status(403).json({
      success: false,
      message: 'Origin is not allowed for state-changing request.',
    });
  }

  return next();
};

export default {
  stateChangeOriginGuard,
};
