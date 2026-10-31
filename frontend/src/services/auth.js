/**
 * Authentication API Service
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User data and tokens
 */
export const loginAPI = async (email, password) => {
  const response = await apiClient.post(API_ENDPOINTS.LOGIN, {
    email,
    password,
  });
  return response.data;
};

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} User data and tokens
 */
export const registerAPI = async (userData) => {
  const response = await apiClient.post(API_ENDPOINTS.REGISTER, userData);
  return response.data;
};

/**
 * Get current user profile
 * @returns {Promise<Object>} User profile data
 */
export const getMeAPI = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

/**
 * Refresh access token
 * @returns {Promise<Object>} New access token
 */
export const refreshTokenAPI = async () => {
  const response = await apiClient.post(API_ENDPOINTS.REFRESH_TOKEN);
  return response.data;
};

export const logoutAPI = async () => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

export const changePasswordAPI = async (currentPassword, newPassword) => {
  const response = await apiClient.post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return response.data;
};

/**
 * Verify MFA challenge during login
 * @param {string} mfaTicket - MFA ticket returned from login endpoint
 * @param {string} otpCode - One time code
 * @returns {Promise<Object>} User data and tokens
 */
export const verifyMfaAPI = async (mfaTicket, otpCode) => {
  const response = await apiClient.post(API_ENDPOINTS.VERIFY_MFA, {
    mfaTicket,
    otpCode,
  });
  return response.data;
};

export default {
  loginAPI,
  registerAPI,
  getMeAPI,
  refreshTokenAPI,
  logoutAPI,
  changePasswordAPI,
  verifyMfaAPI,
};
