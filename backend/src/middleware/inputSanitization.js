import { sanitizeInput } from '../utils/validators.js';

/**
 * Input Sanitization Middleware
 * Sanitizes all incoming request data
 */
const sanitizeRequestData = (data) => {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item));
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeRequestData(value);
    }
    return sanitized;
  }
  return data;
};

// Signed clinical decision packages are integrity-sensitive payloads. Any
// normalization (even trimming or removing angle brackets from symptom text)
// changes the canonical JSON and invalidates the package digest. Keep this
// subtree byte-for-byte equivalent to what the caller submitted; the package
// is still validated cryptographically by the verification controller.
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sanitizeRequestData(body);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] = key === 'decisionPackage'
      ? value
      : sanitizeRequestData(value);
  }
  return sanitized;
};

const inputSanitization = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeBody(req.body);
  }
  if (req.query) {
    req.query = sanitizeRequestData(req.query);
  }
  if (req.params) {
    req.params = sanitizeRequestData(req.params);
  }
  next();
};

export default inputSanitization;
