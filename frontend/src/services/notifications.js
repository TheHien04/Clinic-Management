import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

export const getNotificationInboxAPI = async () => {
  const response = await apiClient.get(API_ENDPOINTS.NOTIFICATION_INBOX);
  return response.data;
};

export const createNotificationAPI = async (payload) => {
  const response = await apiClient.post(API_ENDPOINTS.NOTIFICATION_CREATE, payload);
  return response.data;
};

export const markNotificationReadAPI = async (id) => {
  const response = await apiClient.patch(API_ENDPOINTS.NOTIFICATION_MARK_READ(id));
  return response.data;
};

export const getDeliveryQueueAPI = async () => {
  const response = await apiClient.get(API_ENDPOINTS.NOTIFICATION_DELIVERY_QUEUE);
  return response.data;
};

export const processDeliveryQueueAPI = async (payload = {}) => {
  const response = await apiClient.post(API_ENDPOINTS.NOTIFICATION_DELIVERY_PROCESS, payload);
  return response.data;
};

export const getDeadLetterQueueAPI = async () => {
  const response = await apiClient.get(API_ENDPOINTS.NOTIFICATION_DEAD_LETTER);
  return response.data;
};

export default {
  getNotificationInboxAPI,
  createNotificationAPI,
  markNotificationReadAPI,
  getDeliveryQueueAPI,
  processDeliveryQueueAPI,
  getDeadLetterQueueAPI,
};
