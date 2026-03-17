/**
 * Doctor API Service
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

/**
 * Get all doctors
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} List of doctors
 */
export const getDoctorsAPI = async (filters = {}) => {
  const response = await apiClient.get(API_ENDPOINTS.DOCTORS, {
    params: filters,
  });
  return response.data;
};

/**
 * Get doctors intelligence payload for capacity and rebalance board.
 * Returns null for auth failures so UI can fallback to local calculations.
 */
export const getDoctorsIntelligenceAPI = async () => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.DOCTORS_INTELLIGENCE);
    return response.data;
  } catch (error) {
    const status = error?.response?.status ?? error?.status;
    if (status === 401 || status === 403) {
      return null;
    }
    throw error;
  }
};

/**
 * Apply doctors rebalance plan and persist reassignment in backend.
 */
export const applyDoctorsRebalanceAPI = async (payload = {}) => {
  const response = await apiClient.post(API_ENDPOINTS.DOCTORS_REBALANCE_APPLY, payload);
  return response.data;
};

/**
 * Get doctor by ID
 * @param {number} id - Doctor ID
 * @returns {Promise<Object>} Doctor data
 */
export const getDoctorByIdAPI = async (id) => {
  const response = await apiClient.get(API_ENDPOINTS.DOCTOR_BY_ID(id));
  return response.data;
};

/**
 * Get doctor schedule
 * @param {number} id - Doctor ID
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Doctor schedule
 */
export const getDoctorScheduleAPI = async (id, filters = {}) => {
  const response = await apiClient.get(API_ENDPOINTS.DOCTOR_SCHEDULE(id), {
    params: filters,
  });
  return response.data;
};

/**
 * Create new doctor
 * @param {Object} doctorData - Doctor details
 * @returns {Promise<Object>} Created doctor
 */
export const createDoctorAPI = async (doctorData) => {
  const response = await apiClient.post(API_ENDPOINTS.DOCTORS, doctorData);
  return response.data;
};

/**
 * Update doctor
 * @param {number} id - Doctor ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated doctor
 */
export const updateDoctorAPI = async (id, updateData) => {
  const response = await apiClient.put(API_ENDPOINTS.DOCTOR_BY_ID(id), updateData);
  return response.data;
};

/**
 * Delete doctor
 * @param {number} id - Doctor ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteDoctorAPI = async (id) => {
  const response = await apiClient.delete(API_ENDPOINTS.DOCTOR_BY_ID(id));
  return response.data;
};

export default {
  getDoctorsAPI,
  getDoctorsIntelligenceAPI,
  applyDoctorsRebalanceAPI,
  getDoctorByIdAPI,
  getDoctorScheduleAPI,
  createDoctorAPI,
  updateDoctorAPI,
  deleteDoctorAPI,
};
