const DEV_DEFAULT_ORIGIN = 'http://localhost:5173';

const splitCsv = (value) => {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const isProduction = () => process.env.NODE_ENV === 'production';

export const validateProductionEnv = () => {
  if (!isProduction()) {
    return;
  }

  const required = [
    'DB_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGIN',
    'SOCKET_CORS_ORIGIN',
  ];

  const missing = required.filter((name) => !String(process.env[name] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const weakSecret = secrets.find((name) => {
    const value = String(process.env[name] || '').trim().toLowerCase();
    return value.length < 32 || ['change-me', 'changeme', 'secret', 'password'].some((marker) => value.includes(marker));
  });
  if (weakSecret) {
    throw new Error(`${weakSecret} must be a unique random secret of at least 32 characters in production.`);
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different in production.');
  }

  const origins = [...splitCsv(process.env.CORS_ORIGIN), ...splitCsv(process.env.SOCKET_CORS_ORIGIN)];
  if (origins.some((origin) => origin === '*' || origin.includes('*'))) {
    throw new Error('Wildcard CORS origins are not allowed in production.');
  }
  origins.forEach((origin) => {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid production CORS origin: ${origin}`);
    }
    const isLocalHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(isLocalHttp && process.env.ALLOW_INSECURE_HTTP === 'true')) {
      throw new Error(`Production CORS origin must use HTTPS: ${origin}`);
    }
  });

  if (process.env.DB_ENCRYPT !== 'true' && process.env.ALLOW_INSECURE_DB_TLS !== 'true') {
    throw new Error('DB_ENCRYPT=true is required in production (or explicitly set ALLOW_INSECURE_DB_TLS=true for local containers).');
  }
};

export const getAllowedOrigins = (envName, fallbackOrigin = DEV_DEFAULT_ORIGIN) => {
  const configured = splitCsv(process.env[envName]);
  if (configured.length) {
    return configured;
  }

  if (isProduction()) {
    throw new Error(`Missing ${envName} in production environment.`);
  }

  return splitCsv(fallbackOrigin);
};
