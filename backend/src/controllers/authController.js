/**
 * Authentication Controller
 */

import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import { isValidEmail, validatePassword, sanitizeInput } from '../utils/validators.js';

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // Check if user already exists
    const checkUserQuery = `SELECT AccountID FROM Accounts WHERE Email = @email`;
    const existingUser = await executeQuery(checkUserQuery, { email });

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const insertQuery = `
      INSERT INTO Accounts (Email, Password, FullName, Role, CreatedDate)
      OUTPUT INSERTED.AccountID, INSERTED.Email, INSERTED.FullName, INSERTED.Role
      VALUES (@email, @password, @name, @role, GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      email: sanitizeInput(email),
      password: hashedPassword,
      name: sanitizeInput(name),
      role
    });

    const user = result.recordset[0];

    // Generate tokens
    const token = generateToken({
      id: user.AccountID,
      email: user.Email,
      role: user.Role
    });

    const refreshToken = generateRefreshToken({
      id: user.AccountID
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.AccountID,
          email: user.Email,
          name: user.FullName,
          role: user.Role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const query = `
      SELECT AccountID, Email, Password, FullName, Role 
      FROM Accounts 
      WHERE Email = @email AND IsActive = 1
    `;
    
    const result = await executeQuery(query, { email });

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.recordset[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = generateToken({
      id: user.AccountID,
      email: user.Email,
      role: user.Role
    });

    const refreshToken = generateRefreshToken({
      id: user.AccountID
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.AccountID,
          email: user.Email,
          name: user.FullName,
          role: user.Role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new access token
    const query = `
      SELECT AccountID, Email, Role 
      FROM Accounts 
      WHERE AccountID = @id AND IsActive = 1
    `;
    
    const result = await executeQuery(query, { id: decoded.id });

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = result.recordset[0];

    const newToken = generateToken({
      id: user.AccountID,
      email: user.Email,
      role: user.Role
    });

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    const query = `
      SELECT AccountID, Email, FullName, Role, PhoneNumber, CreatedDate
      FROM Accounts 
      WHERE AccountID = @id AND IsActive = 1
    `;
    
    const result = await executeQuery(query, { id: req.user.id });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.recordset[0];

    res.json({
      success: true,
      data: {
        id: user.AccountID,
        email: user.Email,
        name: user.FullName,
        role: user.Role,
        phone: user.PhoneNumber,
        createdDate: user.CreatedDate
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default { register, login, refreshToken, getMe };
