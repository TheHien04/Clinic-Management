// Application configuration constants

// Routes
export const ROUTES = {
  LOGIN: 'login',
  REGISTER: 'register',
  DASHBOARD: 'dashboard',
  APPOINTMENTS: 'appointments',
  PATIENTS: 'patients',
  DOCTORS: 'doctors',
  REPORTS: 'reports',
  MEDICAL_RECORDS: 'medical-records',
  // Đã xoá các route staff, clinics, specialties, salaries
};

// API Endpoints (for future backend integration)
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  VERIFY_OTP: '/api/auth/verify-otp',
  REFRESH_TOKEN: '/api/auth/refresh',
  
  // Appointments
  APPOINTMENTS: '/api/appointments',
  APPOINTMENT_BY_ID: (id) => `/api/appointments/${id}`,
  
  // Patients
  PATIENTS: '/api/patients',
  PATIENT_BY_ID: (id) => `/api/patients/${id}`,
  PATIENT_HISTORY: (id) => `/api/patients/${id}/history`,
  
  // Doctors
  DOCTORS: '/api/doctors',
  DOCTOR_BY_ID: (id) => `/api/doctors/${id}`,
  DOCTOR_SCHEDULE: (id) => `/api/doctors/${id}/schedule`,
  
  // Reports
  REPORTS: '/api/reports',
  EXPORT_CSV: '/api/reports/export',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER: 'user',
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  THEME: 'app_theme',
};

// Mock Users (for demo)
export const MOCK_USERS = [
  { email: 'hiendepzai', password: '123456', name: 'Hien Nguyen' },
  { email: 'hienhihi', password: '159357', name: 'Hien Le' },
  { email: 'admin@clinic.com', password: '123456', name: 'Admin User' },
  { email: 'admin@example.com', password: '123456', name: 'Example Admin' },
];

// Mock OTP (for demo)
export const MOCK_OTP = '123456';

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  API: 'YYYY-MM-DD',
  DATETIME: 'DD/MM/YYYY HH:mm',
};

// Toast duration
export const TOAST_DURATION = 3000;

// File upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
};

// Appointment status
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked-in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Doctor status
export const DOCTOR_STATUS = {
  ACTIVE: 'active',
  ON_LEAVE: 'onleave',
  INACTIVE: 'inactive',
};

// Validation rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[0-9]{10,11}$/,
  PASSWORD_MIN_LENGTH: 6,
  OTP_LENGTH: 6,
};
