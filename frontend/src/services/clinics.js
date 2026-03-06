/**
 * Clinic API Service
 */

import api from './api';

/**
 * Get all clinics
 */
export const getAllClinicsAPI = async () => {
  const response = await api.get('/clinics');
  return response.data;
};

/**
 * Get clinic by ID
 */
export const getClinicByIdAPI = async (id) => {
  const response = await api.get(`/clinics/${id}`);
  return response.data;
};

/**
 * Create new clinic
 */
export const createClinicAPI = async (data) => {
  const response = await api.post('/clinics', data);
  return response.data;
};

/**
 * Update clinic
 */
export const updateClinicAPI = async (id, data) => {
  const response = await api.put(`/clinics/${id}`, data);
  return response.data;
};

/**
 * Delete clinic
 */
export const deleteClinicAPI = async (id) => {
  const response = await api.delete(`/clinics/${id}`);
  return response.data;
};
