/**
 * File Upload API Service
 */

import apiClient from './api';

/**
 * Upload single file
 * @param {File} file - File to upload
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Upload result
 */
export const uploadSingleFileAPI = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/upload/single', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

/**
 * Upload multiple files
 * @param {FileList|Array} files - Files to upload
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Upload result
 */
export const uploadMultipleFilesAPI = async (files, onProgress) => {
  const formData = new FormData();
  
  Array.from(files).forEach((file) => {
    formData.append('files', file);
  });

  const response = await apiClient.post('/upload/multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

export default {
  uploadSingleFileAPI,
  uploadMultipleFilesAPI,
};
