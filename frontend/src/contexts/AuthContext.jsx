/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { STORAGE_KEYS, MOCK_USERS, MOCK_OTP } from '../constants';
import { loginAPI, registerAPI, getMeAPI } from '../services/auth';
import { initSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    
    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        logout();
      }
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
      // Try real API first
      try {
        const response = await loginAPI(email, password);
        const { user, token, refreshToken } = response;

        // Store in localStorage
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

        setUser(user);
        setIsAuthenticated(true);

        // Initialize WebSocket connection
        initSocket();

        return { success: true, requiresOTP: false };
      } catch (apiError) {
        console.warn('API login failed, falling back to mock:', apiError.message);
        
        // Fallback to mock authentication
        const foundUser = MOCK_USERS.find(
          u => u.email === email && u.password === password
        );

        if (!foundUser) {
          throw new Error('Invalid credentials');
        }

        const mockToken = 'fake_token_' + Date.now();
        const userData = {
          email: foundUser.email,
          name: foundUser.name || email,
        };

        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        localStorage.setItem(STORAGE_KEYS.TOKEN, mockToken);

        setUser(userData);
        setIsAuthenticated(true);

        return { success: true, requiresOTP: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Verify OTP code
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} Result with success status
   */
  const verifyOTP = async (otp) => {
    try {
      // Mock OTP verification - replace with real API call
      if (otp !== MOCK_OTP) {
        throw new Error('Invalid OTP');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
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
      // Try real API first
      try {
        const response = await registerAPI(userData);
        const { user, token, refreshToken } = response;

        // Store in localStorage
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

        setUser(user);
        setIsAuthenticated(true);

        // Initialize WebSocket connection
        initSocket();

        return { success: true, message: 'Registration successful' };
      } catch (apiError) {
        console.warn('API registration failed, using mock:', apiError.message);
        
        // Fallback to mock registration
        const { email, password, name } = userData;

        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        // Check if user already exists in mock data
        const exists = MOCK_USERS.find(u => u.email === email);
        if (exists) {
          throw new Error('User already exists');
        }

        return { success: true, message: 'Registration successful (mock)' };
      }
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

export default AuthContext;
