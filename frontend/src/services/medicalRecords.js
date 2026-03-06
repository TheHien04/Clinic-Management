/**
 * Medical Records API Service
 */

import api from './api';

const MEDICAL_RECORDS_URL = '/medical-records';

/**
 * Get all medical records with filtering
 * @param {Object} params - Query parameters (patientId, startDate, endDate, page, limit)
 * @returns {Promise} API response with medical records data
 */
export const getMedicalRecordsAPI = async (params = {}) => {
  const response = await api.get(MEDICAL_RECORDS_URL, { params });
  return response.data;
};

/**
 * Get medical record by ID
 * @param {number} id - Medical record ID
 * @returns {Promise} API response with medical record data
 */
export const getMedicalRecordByIdAPI = async (id) => {
  const response = await api.get(`${MEDICAL_RECORDS_URL}/${id}`);
  return response.data;
};

/**
 * Get medical records by patient ID
 * @param {number} patientId - Patient ID
 * @returns {Promise} API response with patient's medical records
 */
export const getMedicalRecordsByPatientAPI = async (patientId) => {
  const response = await api.get(`${MEDICAL_RECORDS_URL}/patient/${patientId}`);
  return response.data;
};

/**
 * Create new medical record
 * @param {Object} data - Medical record data
 * @param {number} data.appId - Appointment ID
 * @param {string} data.diagnosisCode - Diagnosis code (ICD-10)
 * @param {string} data.prescription - Prescription details
 * @param {string} data.notes - Medical notes
 * @param {string} data.followUpDate - Follow-up date
 * @returns {Promise} API response with created medical record
 */
export const createMedicalRecordAPI = async (data) => {
  const response = await api.post(MEDICAL_RECORDS_URL, data);
  return response.data;
};

/**
 * Update medical record
 * @param {number} id - Medical record ID
 * @param {Object} data - Updated medical record data
 * @returns {Promise} API response with updated medical record
 */
export const updateMedicalRecordAPI = async (id, data) => {
  const response = await api.put(`${MEDICAL_RECORDS_URL}/${id}`, data);
  return response.data;
};

/**
 * Delete medical record
 * @param {number} id - Medical record ID
 * @returns {Promise} API response
 */
export const deleteMedicalRecordAPI = async (id) => {
  const response = await api.delete(`${MEDICAL_RECORDS_URL}/${id}`);
  return response.data;
};

export default {
  getMedicalRecordsAPI,
  getMedicalRecordByIdAPI,
  getMedicalRecordsByPatientAPI,
  createMedicalRecordAPI,
  updateMedicalRecordAPI,
  deleteMedicalRecordAPI
};
