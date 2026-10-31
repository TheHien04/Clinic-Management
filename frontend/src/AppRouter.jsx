import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AppointmentProvider } from './contexts/AppointmentContext';
import { ROUTES } from './constants';
import { hasValidSession } from './utils/authSession';
import { useAuth } from './contexts/auth-context';

const STAFF_ROLES = ['admin', 'manager', 'supervisor', 'doctor', 'nurse', 'receptionist'];
const CLINICAL_ROLES = ['admin', 'manager', 'supervisor', 'doctor', 'nurse'];
const REPORT_ROLES = ['admin', 'manager', 'supervisor', 'doctor'];
const PATIENT_ROLES = ['patient', 'user'];

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Patients = lazy(() => import('./pages/Patients'));
const Doctors = lazy(() => import('./pages/Doctors'));
const Reports = lazy(() => import('./pages/Reports'));
const MedicalRecords = lazy(() => import('./pages/MedicalRecords'));
const InnovationLab = lazy(() => import('./pages/InnovationLab'));
const Bioinformatics = lazy(() => import('./pages/Bioinformatics'));
const Notifications = lazy(() => import('./pages/Notifications'));
const HospitalPortal = lazy(() => import('./pages/HospitalPortal'));
const PatientPortal = lazy(() => import('./pages/PatientPortal'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

const TITLE_BY_PATH = {
  [`/${ROUTES.DASHBOARD}`]: 'Dashboard | Clinic Management',
  [`/${ROUTES.APPOINTMENTS}`]: 'Appointments | Clinic Management',
  [`/${ROUTES.PATIENTS}`]: 'Patients | Clinic Management',
  [`/${ROUTES.DOCTORS}`]: 'Doctors | Clinic Management',
  [`/${ROUTES.REPORTS}`]: 'Reports | Clinic Management',
  [`/${ROUTES.MEDICAL_RECORDS}`]: 'Medical Records | Clinic Management',
  [`/${ROUTES.INNOVATION_LAB}`]: 'Innovation Lab | Clinic Management',
  [`/${ROUTES.BIOINFORMATICS}`]: 'Bioinformatics Atlas | Clinic Management',
  [`/${ROUTES.NOTIFICATIONS}`]: 'Notifications | Clinic Management',
  [`/${ROUTES.HOSPITAL_PORTAL}`]: 'Hospital Portal | Clinic Management',
  [`/${ROUTES.PATIENT_PORTAL}`]: 'Patient Portal | Clinic Management',
  [`/${ROUTES.LOGIN}`]: 'Login | Clinic Management',
  [`/${ROUTES.REGISTER}`]: 'Register | Clinic Management',
};

function RouteTitleManager() {
  const location = useLocation();

  React.useEffect(() => {
    document.title = TITLE_BY_PATH[location.pathname] || 'Clinic Management';
    // Each workspace is a distinct task surface. Starting halfway down the
    // previous page made hero content appear cropped and broke orientation.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return null;
}

export default function AppRouter() {
  const { user } = useAuth();
  const isAuthenticated = () => hasValidSession();
  const defaultRoute = PATIENT_ROLES.includes(String(user?.role || '').toLowerCase())
    ? ROUTES.PATIENT_PORTAL
    : ROUTES.DASHBOARD;

  return (
    <BrowserRouter>
      <RouteTitleManager />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppointmentProvider>
        <Suspense fallback={<div style={{ padding: 24 }}>Loading page...</div>}>
          <Routes>
            <Route 
              path={`/${ROUTES.LOGIN}`} 
              element={isAuthenticated() ? <Navigate to={`/${defaultRoute}`} replace /> : <Login />}
            />
            <Route 
              path={`/${ROUTES.REGISTER}`} 
              element={isAuthenticated() ? <Navigate to={`/${defaultRoute}`} replace /> : <Register />}
            />

            <Route 
              path={`/${ROUTES.DASHBOARD}`} 
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.APPOINTMENTS}`} 
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <Appointments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.PATIENTS}`} 
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <Patients />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.DOCTORS}`} 
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <Doctors />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.REPORTS}`} 
              element={
                <ProtectedRoute roles={REPORT_ROLES}>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.MEDICAL_RECORDS}`} 
              element={
                <ProtectedRoute roles={CLINICAL_ROLES}>
                  <MedicalRecords />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.INNOVATION_LAB}`} 
              element={
                <ProtectedRoute roles={CLINICAL_ROLES}>
                  <InnovationLab />
                </ProtectedRoute>
              } 
            />
            <Route
              path={`/${ROUTES.BIOINFORMATICS}`}
              element={
                <ProtectedRoute roles={CLINICAL_ROLES}>
                  <Bioinformatics />
                </ProtectedRoute>
              }
            />
            <Route
              path={`/${ROUTES.NOTIFICATIONS}`}
              element={
                <ProtectedRoute roles={[...STAFF_ROLES, ...PATIENT_ROLES]}>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path={`/${ROUTES.HOSPITAL_PORTAL}`}
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <HospitalPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path={`/${ROUTES.PATIENT_PORTAL}`}
              element={
                <ProtectedRoute roles={PATIENT_ROLES}>
                  <PatientPortal />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/" 
              element={
                isAuthenticated() 
                  ? <Navigate to={`/${defaultRoute}`} replace />
                  : <Navigate to={`/${ROUTES.LOGIN}`} replace />
              } 
            />
            <Route 
              path="*" 
              element={
                isAuthenticated() 
                  ? <Navigate to={`/${defaultRoute}`} replace />
                  : <Navigate to={`/${ROUTES.LOGIN}`} replace />
              } 
            />
          </Routes>
        </Suspense>
      </AppointmentProvider>
    </BrowserRouter>
  );
}
