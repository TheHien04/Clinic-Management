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
