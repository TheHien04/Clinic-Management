/**
 * Patient API Service
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

/**
 * Get all patients
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} List of patients
 */
export const getPatientsAPI = async (filters = {}) => {
  const response = await apiClient.get(API_ENDPOINTS.PATIENTS, {
    params: filters,
  });
  return response.data;
};

/**
 * Get patient by ID
 * @param {number} id - Patient ID
 * @returns {Promise<Object>} Patient data
 */
export const getPatientByIdAPI = async (id) => {
  const response = await apiClient.get(API_ENDPOINTS.PATIENT_BY_ID(id));
  return response.data;
};

/**
 * Get patient appointment history
 * @param {number} id - Patient ID
 * @returns {Promise<Array>} Patient appointment history
 */
export const getPatientHistoryAPI = async (id) => {
  const response = await apiClient.get(API_ENDPOINTS.PATIENT_HISTORY(id));
  return response.data;
};

/**
 * Create new patient
 * @param {Object} patientData - Patient details
 * @returns {Promise<Object>} Created patient
 */
export const createPatientAPI = async (patientData) => {
  const response = await apiClient.post(API_ENDPOINTS.PATIENTS, patientData);
  return response.data;
};

/**
 * Update patient
 * @param {number} id - Patient ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated patient
 */
export const updatePatientAPI = async (id, updateData) => {
  const response = await apiClient.put(API_ENDPOINTS.PATIENT_BY_ID(id), updateData);
  return response.data;
};

/**
 * Delete patient
 * @param {number} id - Patient ID
 * @returns {Promise<Object>} Deletion result
 */
export const deletePatientAPI = async (id) => {
  const response = await apiClient.delete(API_ENDPOINTS.PATIENT_BY_ID(id));
  return response.data;
};

export default {
  getPatientsAPI,
  getPatientByIdAPI,
  getPatientHistoryAPI,
  createPatientAPI,
  updatePatientAPI,
  deletePatientAPI,
};
