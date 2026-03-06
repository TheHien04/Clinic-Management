/**
 * Specialty API Service
 */

import api from './api';

/**
 * Get all specialties
 */export const getAllSpecialtiesAPI = async () => {
  const response = await api.get('/specialties');
  return response.data;
};

/**
 * Get specialty by ID
 */
export const getSpecialtyByIdAPI = async (id) => {
  const response = await api.get(`/specialties/${id}`);
  return response.data;
};

/**
 * Create new specialty
 */
export const createSpecialtyAPI = async (data) => {
  const response = await api.post('/specialties', data);
  return response.data;
};

/**
 * Update specialty
 */
export const updateSpecialtyAPI = async (id, data) => {
  const response = await api.put(`/specialties/${id}`, data);
  return response.data;
};

/**
 * Delete specialty
 */
export const deleteSpecialtyAPI = async (id) => {
  const response = await api.delete(`/specialties/${id}`);
  return response.data;
};
