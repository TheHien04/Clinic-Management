/**
 * Prevent internal exception details from crossing the production API boundary.
 * Controllers can keep useful diagnostics for development while production
 * responses expose only their stable public message.
 */
export const responseSanitization = (_req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (
      process.env.NODE_ENV === 'production'
      && res.statusCode >= 500
      && body
      && typeof body === 'object'
      && !Array.isArray(body)
    ) {
      const safeBody = { ...body };
      delete safeBody.error;
      delete safeBody.stack;
      delete safeBody.details;
      return originalJson(safeBody);
    }

    return originalJson(body);
  };

  next();
};

export default responseSanitization;
