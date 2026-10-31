/**
 * JWT Utility Functions
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { jwtConfig } from '../config/jwt.js';

/**
 * Generate JWT access token
 * @param {Object} payload - User data to encode
 * @returns {string} JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - User data to encode
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
    // A unique token identifier makes every rotation cryptographically
    // distinct even when two tokens are minted during the same second.
    jwtid: crypto.randomUUID(),
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token data
 */
export const verifyToken = (token) => {
  return jwt.verify(token, jwtConfig.secret);
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token data
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshSecret);
};

export default {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken
};
