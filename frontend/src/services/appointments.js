/**
 * Appointment API Service
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

const mapAppointmentFromBackend = (item) => {
  // Support both backend schema and legacy frontend mock schema.
  if (item.AppointmentID || item.AppointmentDate) {
    return {
      id: item.AppointmentID,
      date: item.AppointmentDate ? String(item.AppointmentDate).slice(0, 10) : '',
      time: item.AppointmentTime ? String(item.AppointmentTime).slice(0, 5) : '',
      status: normalizeStatus(item.Status),
      patient: item.PatientName || `Patient #${item.PatientID || ''}`,
      doctor: item.DoctorName || `Doctor #${item.DoctorID || ''}`,
      fee: Number(item.Fee || 0),
      service: item.SpecialtyName || 'General Consultation',
      notes: item.Notes || '',
    };
  }

  return {
    ...item,
    status: normalizeStatus(item.status),
  };
};

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
 * Fetch appointments and normalize them for analytics components.
 * Returns [] on auth/network error so UI can fallback gracefully.
 */
export const getAppointmentsForAnalyticsAPI = async (filters = {}) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.APPOINTMENTS, {
      params: filters,
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map(mapAppointmentFromBackend);
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return [];
    }
    throw error;
  }
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
  getAppointmentsForAnalyticsAPI,
  getAppointmentByIdAPI,
  createAppointmentAPI,
  updateAppointmentAPI,
  deleteAppointmentAPI,
};
