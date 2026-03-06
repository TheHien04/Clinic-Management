/**
 * File upload utilities for handling file validation and processing
 */

import { FILE_UPLOAD } from '../constants';

/**
 * Validate file size
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum size in bytes (default from constants)
 * @returns {boolean} True if valid
 */
export const validateFileSize = (file, maxSize = FILE_UPLOAD.MAX_SIZE) => {
  return file.size <= maxSize;
};

/**
 * Validate file type
 * @param {File} file - File to validate
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} True if valid
 */
export const validateFileType = (file, allowedTypes = FILE_UPLOAD.ALLOWED_TYPES) => {
  return allowedTypes.includes(file.type);
};

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} File extension with dot (e.g., '.jpg')
 */
export const getFileExtension = (filename) => {
  return filename.slice(filename.lastIndexOf('.'));
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., '2.5 MB')
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Read file as data URL (base64)
 * @param {File} file - File to read
 * @returns {Promise<string>} Data URL
 */
export const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Read file as text
 * @param {File} file - File to read
 * @returns {Promise<string>} File content as text
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

/**
 * Validate and process image file
 * @param {File} file - Image file to process
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Processed file data or error
 */
export const processImageFile = async (file, options = {}) => {
  const {
    maxSize = FILE_UPLOAD.MAX_SIZE,
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
  } = options;

  // Validate size
  if (!validateFileSize(file, maxSize)) {
    throw new Error(`File size exceeds ${formatFileSize(maxSize)}`);
  }

  // Validate type
  if (!validateFileType(file, allowedTypes)) {
    throw new Error('Invalid file type. Allowed: ' + allowedTypes.join(', '));
  }

  // Read as data URL
  const dataURL = await readFileAsDataURL(file);

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    dataURL,
    formattedSize: formatFileSize(file.size),
  };
};

/**
 * Validate and process document file
 * @param {File} file - Document file to process
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Processed file data or error
 */
export const processDocumentFile = async (file, options = {}) => {
  const {
    maxSize = FILE_UPLOAD.MAX_SIZE,
    allowedTypes = FILE_UPLOAD.ALLOWED_TYPES,
  } = options;

  // Validate size
  if (!validateFileSize(file, maxSize)) {
    throw new Error(`File size exceeds ${formatFileSize(maxSize)}`);
  }

  // Validate type
  if (!validateFileType(file, allowedTypes)) {
    throw new Error('Invalid file type. Allowed: ' + allowedTypes.join(', '));
  }

  // Read as data URL
  const dataURL = await readFileAsDataURL(file);

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    dataURL,
    formattedSize: formatFileSize(file.size),
    extension: getFileExtension(file.name),
  };
};

/**
 * Create FormData for file upload
 * @param {File} file - File to upload
 * @param {Object} additionalData - Additional form fields
 * @returns {FormData} FormData object ready for upload
 */
export const createFileUploadFormData = (file, additionalData = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  Object.keys(additionalData).forEach(key => {
    formData.append(key, additionalData[key]);
  });
  
  return formData;
};
