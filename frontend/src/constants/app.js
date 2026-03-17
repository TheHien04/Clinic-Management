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
  INNOVATION_LAB: 'innovation-lab',
  // Đã xoá các route staff, clinics, specialties, salaries
};

// API Endpoints (for future backend integration)
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  VERIFY_OTP: '/auth/verify-otp',
  REFRESH_TOKEN: '/auth/refresh',
  
  // Appointments
  APPOINTMENTS: '/appointments',
  APPOINTMENT_BY_ID: (id) => `/appointments/${id}`,
  
  // Patients
  PATIENTS: '/patients',
  PATIENT_BY_ID: (id) => `/patients/${id}`,
  PATIENT_HISTORY: (id) => `/patients/${id}/history`,
  
  // Doctors
  DOCTORS: '/doctors',
  DOCTORS_INTELLIGENCE: '/doctors/intelligence',
  DOCTORS_REBALANCE_APPLY: '/doctors/rebalance/apply',
  DOCTOR_BY_ID: (id) => `/doctors/${id}`,
  DOCTOR_SCHEDULE: (id) => `/doctors/${id}/schedule`,
  
  // Reports
  REPORTS: '/reports',
  EXPORT_CSV: '/reports/export',

  // Innovation
  INNOVATION_SECURITY_POSTURE: '/innovation/security/posture',
  INNOVATION_AI_TRIAGE: '/innovation/ai/triage',
  INNOVATION_PREVENTIVE_INSIGHTS: '/innovation/health/preventive-insights',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER: 'user',
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  THEME: 'app_theme',
};

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

// Internationalization defaults
export const APP_I18N = {
  LOCALE: 'en-GB',
  CURRENCY: 'VND',
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
