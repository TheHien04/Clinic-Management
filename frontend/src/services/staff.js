/**
 * Staff API Service
 */

import api from './api';

/**
 * Get all staff with filters
 */
export const getAllStaffAPI = async (params = {}) => {
  const response = await api.get('/staff', { params });
  return response.data;
};

/**
 * Get staff by ID
 */
export const getStaffByIdAPI = async (id) => {
  const response = await api.get(`/staff/${id}`);
  return response.data;
};

/**
 * Create new staff
 */
export const createStaffAPI = async (data) => {
  const response = await api.post('/staff', data);
  return response.data;
};

/**
 * Update staff
 */
export const updateStaffAPI = async (id, data) => {
  const response = await api.put(`/staff/${id}`, data);
  return response.data;
};

/**
 * Delete staff
 */
export const deleteStaffAPI = async (id) => {
  const response = await api.delete(`/staff/${id}`);
  return response.data;
};
