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

const inputSanitization = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeRequestData(req.body);
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
