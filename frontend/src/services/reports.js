/**
 * Reports API Service
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

export const getReportsAnalyticsAPI = async (filters = {}) => {
  const response = await apiClient.get(`${API_ENDPOINTS.REPORTS}/analytics`, {
    params: filters,
  });
  // Support both wrapped ({ success, data }) and direct payloads.
  return response?.data || response;
};

export const askReportsAssistantAPI = async (payload = {}) => {
  const response = await apiClient.post(`${API_ENDPOINTS.REPORTS}/assistant`, payload);
  // Support both wrapped ({ success, data }) and direct payloads.
  return response?.data || response;
};

export default {
  getReportsAnalyticsAPI,
  askReportsAssistantAPI,
};
