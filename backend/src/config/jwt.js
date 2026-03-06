/**
 * JWT Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'default_secret_key_change_in_production',
  expiresIn: process.env.JWT_EXPIRE || '7d',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
};

export default jwtConfig;
