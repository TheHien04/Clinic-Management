/**
 * API Service - Axios instance with interceptors
 */

import axios from 'axios';
import { STORAGE_KEYS } from '../constants';
import { getApiBaseUrl } from '../utils/runtimeEnv';

// API base URL
const API_BASE_URL = getApiBaseUrl();

const isLikelyJwt = (value) => {
  const token = String(value || '').trim();
  return token.split('.').length === 3;
};

const clearSessionAndRedirectToLogin = () => {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (token && isLikelyJwt(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (token) {
      // Legacy or malformed token should not be sent to protected APIs.
      clearSessionAndRedirectToLogin();
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    // Return data directly
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (refreshToken && isLikelyJwt(refreshToken)) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token } = response.data.data;
          localStorage.setItem(STORAGE_KEYS.TOKEN, token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }

        clearSessionAndRedirectToLogin();
      } catch (refreshError) {
        // Refresh failed, logout user
        clearSessionAndRedirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    // Return error in consistent format
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

export default apiClient;
