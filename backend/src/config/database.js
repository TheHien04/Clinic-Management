/**
 * SQL Server Database Configuration
 */

import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ClinicManagement',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

/**
 * Get database connection pool
 * @returns {Promise<sql.ConnectionPool>}
 */
export const getPool = async () => {
  if (!pool) {
    pool = await sql.connect(config);
    console.log('✅ Connected to SQL Server database');
  }
  return pool;
};

/**
 * Execute a SQL query
 * @param {string} query - SQL query string
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export const executeQuery = async (query, params = {}) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    
    // Add parameters to request
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    
    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Close database connection
 */
export const closePool = async () => {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
};

export default { getPool, executeQuery, closePool };
