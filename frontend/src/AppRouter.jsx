import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Reports from './pages/Reports';
import MedicalRecords from './pages/MedicalRecords';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AppointmentProvider } from './contexts/AppointmentContext';
import { ROUTES, STORAGE_KEYS } from './constants';

export default function AppRouter() {
  // Check if user is logged in
  const isAuthenticated = () => localStorage.getItem(STORAGE_KEYS.USER);

  return (
    <BrowserRouter>
      <AppointmentProvider>
        <Routes>
          {/* Public routes */}
          <Route 
            path={`/${ROUTES.LOGIN}`} 
            element={isAuthenticated() ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> : <Login />} 
          />
          <Route 
            path={`/${ROUTES.REGISTER}`} 
            element={isAuthenticated() ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> : <Register />} 
          />
          
          {/* Protected routes */}
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
          {/* Default redirect */}
          <Route 
            path="/" 
            element={
              isAuthenticated() 
                ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> 
                : <Navigate to={`/${ROUTES.LOGIN}`} replace />
            } 
          />
          
          {/* 404 - Redirect to login or dashboard */}
          <Route 
            path="*" 
            element={
              isAuthenticated() 
                ? <Navigate to={`/${ROUTES.DASHBOARD}`} replace /> 
                : <Navigate to={`/${ROUTES.LOGIN}`} replace />
            } 
          />
        </Routes>
      </AppointmentProvider>
    </BrowserRouter>
  );
}
