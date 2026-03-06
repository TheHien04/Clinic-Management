/**
 * Appointment API Service
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

/**
 * Get all appointments
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} List of appointments
 */
export const getAppointmentsAPI = async (filters = {}) => {
  const response = await apiClient.get(API_ENDPOINTS.APPOINTMENTS, {
    params: filters,
  });
  return response.data;
};

/**
 * Get appointment by ID
 * @param {number} id - Appointment ID
 * @returns {Promise<Object>} Appointment data
 */
export const getAppointmentByIdAPI = async (id) => {
  const response = await apiClient.get(API_ENDPOINTS.APPOINTMENT_BY_ID(id));
  return response.data;
};

/**
 * Create new appointment
 * @param {Object} appointmentData - Appointment details
 * @returns {Promise<Object>} Created appointment
 */
export const createAppointmentAPI = async (appointmentData) => {
  const response = await apiClient.post(API_ENDPOINTS.APPOINTMENTS, appointmentData);
  return response.data;
};

/**
 * Update appointment
 * @param {number} id - Appointment ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated appointment
 */
export const updateAppointmentAPI = async (id, updateData) => {
  const response = await apiClient.put(API_ENDPOINTS.APPOINTMENT_BY_ID(id), updateData);
  return response.data;
};

/**
 * Delete appointment
 * @param {number} id - Appointment ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteAppointmentAPI = async (id) => {
  const response = await apiClient.delete(API_ENDPOINTS.APPOINTMENT_BY_ID(id));
  return response.data;
};

export default {
  getAppointmentsAPI,
  getAppointmentByIdAPI,
  createAppointmentAPI,
  updateAppointmentAPI,
  deleteAppointmentAPI,
};
