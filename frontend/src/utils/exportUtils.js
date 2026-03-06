/**
 * Export utilities for generating downloadable files
 */

/**
 * Convert array of objects to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Column definitions [{key: 'field', label: 'Header'}]
 * @returns {string} CSV formatted string
 */
export const convertToCSV = (data, columns) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers
  const headers = columns ? columns.map(col => col.label) : Object.keys(data[0]);
  const keys = columns ? columns.map(col => col.key) : Object.keys(data[0]);

  // Build CSV string
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = keys.map(key => {
      const value = row[key];
      // Escape values that contain commas or quotes
      const escaped = ('' + value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

/**
 * Trigger download of CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of file to download
 */
export const downloadCSV = (csvContent, filename = 'export.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Create download link
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * Export appointments data to CSV
 * @param {Array} appointments - Array of appointment objects
 * @param {string} filename - Optional filename
 */
export const exportAppointmentsCSV = (appointments, filename) => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'patient', label: 'Patient' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status' },
    { key: 'service', label: 'Service' },
  ];
  
  const csvContent = convertToCSV(appointments, columns);
  const finalFilename = filename || `appointments_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, finalFilename);
};

/**
 * Export patients data to CSV
 * @param {Array} patients - Array of patient objects
 * @param {string} filename - Optional filename
 */
export const exportPatientsCSV = (patients, filename) => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'warning', label: 'Medical Alerts' },
  ];
  
  const csvContent = convertToCSV(patients, columns);
  const finalFilename = filename || `patients_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, finalFilename);
};

/**
 * Export doctors data to CSV
 * @param {Array} doctors - Array of doctor objects
 * @param {string} filename - Optional filename
 */
export const exportDoctorsCSV = (doctors, filename) => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'specialty', label: 'Specialty' },
    { key: 'status', label: 'Status' },
    { key: 'contact', label: 'Contact' },
    { key: 'schedule', label: 'Schedule' },
  ];
  
  // Handle specialty array
  const processedDoctors = doctors.map(doc => ({
    ...doc,
    specialty: Array.isArray(doc.specialty) ? doc.specialty.join('; ') : doc.specialty,
  }));
  
  const csvContent = convertToCSV(processedDoctors, columns);
  const finalFilename = filename || `doctors_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, finalFilename);
};

/**
 * Export generic data to CSV
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename for download
 * @param {Array} columns - Optional column definitions
 */
export const exportToCSV = (data, filename, columns = null) => {
  const csvContent = convertToCSV(data, columns);
  downloadCSV(csvContent, filename);
};
