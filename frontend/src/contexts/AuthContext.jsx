/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { STORAGE_KEYS } from '../constants';
import { changePasswordAPI, loginAPI, logoutAPI, registerAPI } from '../services/auth';
import { initSocket, disconnectSocket } from '../services/socket';
import { AuthContext } from './auth-context';

const isLikelyJwt = (value) => String(value || '').trim().split('.').length === 3;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Restore only the current browser-tab session. Refresh tokens stay in an
  // HttpOnly cookie and are never exposed to application JavaScript.
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const storedToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN);

    if (storedUser && storedToken && isLikelyJwt(storedToken)) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);

        // Ensure realtime channel is restored after hard refresh.
        initSocket();
      } catch (error) {
        console.error('Failed to parse user data:', error);
        logout();
      }
    } else if (storedUser || storedToken) {
      // Clean up partial or malformed session artifacts from older builds.
      logout();
    }
    setLoading(false);
  }, []);

  const establishSession = ({ user: nextUser, token }) => {
    if (!nextUser || !token) {
      throw new Error('Invalid session payload');
    }
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nextUser));
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    setUser(nextUser);
    setIsAuthenticated(true);
    initSocket();
  };

  /**
   * Login with username and password
   * @param {string} email - User email/username
   * @param {string} password - User password
   * @returns {Promise<Object>} Result with success status
   */
  const login = async (email, password) => {
    try {
      const response = await loginAPI(email, password);
      if (response?.mfaRequired && response?.mfaTicket) {
        return {
          success: true,
          requiresOTP: true,
          mfaTicket: response.mfaTicket,
          mfaHint: response.mfaHint,
        };
      }
      const { user, token } = response;
      establishSession({ user, token });
      return { success: true, requiresOTP: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Verify OTP code
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} Result with success status
   */
  const verifyOTP = async () => {
    return {
      success: false,
      error: 'OTP verification is not enabled in this environment.',
    };
  };

  /**
   * Logout user
   */
  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    setUser(null);
    setIsAuthenticated(false);
    
    // Disconnect WebSocket
    disconnectSocket();
    logoutAPI().catch(() => {});
  };

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Result with success status
   */
  const register = async (userData) => {
    try {
      const response = await registerAPI(userData);
      const { user, token } = response;
      establishSession({ user, token });
      return { success: true, message: 'Registration successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Update user profile
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Result with success status
   */
  const updateProfile = async (updates) => {
    try {
      const updatedUser = { ...user, ...updates };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Change password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result with success status
   */
  const changePassword = async (currentPassword, newPassword) => {
    try {
      if (!currentPassword || !newPassword) {
        throw new Error('Current and new passwords are required');
      }

      const response = await changePasswordAPI(currentPassword, newPassword);
      return { success: true, message: response?.message || 'Password changed successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    establishSession,
    login,
    logout,
    register,
    verifyOTP,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthProvider;
