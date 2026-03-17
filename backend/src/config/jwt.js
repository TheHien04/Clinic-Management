/**
 * JWT Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const getJwtEnv = (name, fallback) => {
  const value = String(process.env[name] || '').trim();
  if (value) {
    return value;
  }

  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return fallback;
};

export const jwtConfig = {
  secret: getJwtEnv('JWT_SECRET', 'default_secret_key_change_in_production'),
  expiresIn: process.env.JWT_EXPIRE || '7d',
  refreshSecret: getJwtEnv('JWT_REFRESH_SECRET', 'default_refresh_secret'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
};

export default jwtConfig;
