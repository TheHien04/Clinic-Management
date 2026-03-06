/**
 * Salary API Service
 */

import api from './api';

/**
 * Get all salary records with filters
 */
export const getAllSalaryRecordsAPI = async (params = {}) => {
  const response = await api.get('/salaries', { params });
  return response.data;
};

/**
 * Get salary record by ID
 */
export const getSalaryRecordByIdAPI = async (id) => {
  const response = await api.get(`/salaries/${id}`);
  return response.data;
};

/**
 * Calculate salaries for a month
 */
export const calculateSalariesAPI = async (data) => {
  const response = await api.post('/salaries/calculate', data);
  return response.data;
};

/**
 * Get salary summary
 */
export const getSalarySummaryAPI = async (params) => {
  const response = await api.get('/salaries/summary', { params });
  return response.data;
};

/**
 * Delete salary record
 */
export const deleteSalaryRecordAPI = async (id) => {
  const response = await api.delete(`/salaries/${id}`);
  return response.data;
};
