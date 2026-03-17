/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { STORAGE_KEYS } from '../constants';
import { loginAPI, registerAPI } from '../services/auth';
import { initSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

const isLikelyJwt = (value) => String(value || '').trim().split('.').length === 3;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (storedUser && storedToken && storedRefreshToken && isLikelyJwt(storedToken) && isLikelyJwt(storedRefreshToken)) {
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
    } else if (storedUser || storedToken || storedRefreshToken) {
      // Clean up partial or malformed session artifacts from older builds.
      logout();
    }
    setLoading(false);
  }, []);

  /**
   * Login with username and password
   * @param {string} email - User email/username
   * @param {string} password - User password
   * @returns {Promise<Object>} Result with success status
   */
  const login = async (email, password) => {
    try {
      const response = await loginAPI(email, password);
      const { user, token, refreshToken } = response;

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

      setUser(user);
      setIsAuthenticated(true);

      initSocket();

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
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    setUser(null);
    setIsAuthenticated(false);
    
    // Disconnect WebSocket
    disconnectSocket();
  };

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Result with success status
   */
  const register = async (userData) => {
    try {
      const response = await registerAPI(userData);
      const { user, token, refreshToken } = response;

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

      setUser(user);
      setIsAuthenticated(true);

      initSocket();

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
      // Mock password change - replace with real API call
      // In real app, would verify current password and update
      
      if (!currentPassword || !newPassword) {
        throw new Error('Current and new passwords are required');
      }

      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Mock success
      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
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
