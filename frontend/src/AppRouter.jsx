import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AppointmentProvider } from './contexts/AppointmentContext';
import { ROUTES } from './constants';
import { hasValidSession } from './utils/authSession';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Patients = lazy(() => import('./pages/Patients'));
const Doctors = lazy(() => import('./pages/Doctors'));
const Reports = lazy(() => import('./pages/Reports'));
const MedicalRecords = lazy(() => import('./pages/MedicalRecords'));
const InnovationLab = lazy(() => import('./pages/InnovationLab'));
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
  [`/${ROUTES.LOGIN}`]: 'Login | Clinic Management',
  [`/${ROUTES.REGISTER}`]: 'Register | Clinic Management',
};

function RouteTitleManager() {
  const location = useLocation();

  React.useEffect(() => {
    document.title = TITLE_BY_PATH[location.pathname] || 'Clinic Management';
  }, [location.pathname]);

  return null;
}

export default function AppRouter() {
  const isAuthenticated = () => hasValidSession();

  return (
    <BrowserRouter>
      <RouteTitleManager />
      <AppointmentProvider>
        <Suspense fallback={<div style={{ padding: 24 }}>Loading page...</div>}>
          <Routes>
            <Route 
              path={`/${ROUTES.LOGIN}`} 
              element={isAuthenticated() ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> : <Login />} 
            />
            <Route 
              path={`/${ROUTES.REGISTER}`} 
              element={isAuthenticated() ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> : <Register />} 
            />

            <Route 
              path={`/${ROUTES.DASHBOARD}`} 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.APPOINTMENTS}`} 
              element={
                <ProtectedRoute>
                  <Appointments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.PATIENTS}`} 
              element={
                <ProtectedRoute>
                  <Patients />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.DOCTORS}`} 
              element={
                <ProtectedRoute>
                  <Doctors />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.REPORTS}`} 
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.MEDICAL_RECORDS}`} 
              element={
                <ProtectedRoute>
                  <MedicalRecords />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`/${ROUTES.INNOVATION_LAB}`} 
              element={
                <ProtectedRoute>
                  <InnovationLab />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/" 
              element={
                isAuthenticated() 
                  ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> 
                  : <Navigate to={`/${ROUTES.LOGIN}`} replace />
              } 
            />
            <Route 
              path="*" 
              element={
                isAuthenticated() 
                  ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> 
                  : <Navigate to={`/${ROUTES.LOGIN}`} replace />
              } 
            />
          </Routes>
        </Suspense>
      </AppointmentProvider>
    </BrowserRouter>
  );
}
