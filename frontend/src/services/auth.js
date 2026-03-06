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
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token
 */
export const refreshTokenAPI = async (refreshToken) => {
  const response = await apiClient.post(API_ENDPOINTS.REFRESH_TOKEN, {
    refreshToken,
  });
  return response.data;
};

export default {
  loginAPI,
  registerAPI,
  getMeAPI,
  refreshTokenAPI,
};
