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
  getDoctorByIdAPI,
  getDoctorScheduleAPI,
  createDoctorAPI,
  updateDoctorAPI,
  deleteDoctorAPI,
};
