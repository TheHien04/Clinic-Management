import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Register from './pages/Register';

import { AppointmentProvider } from './contexts/AppointmentContext';

const PAGES = {
  login: <Login />,
  register: <Register />,
  dashboard: <Dashboard />,
  appointments: <Appointments />,
  patients: <Patients />,
  doctors: <Doctors />,
  reports: <Reports />,
};

export default function AppRouter() {
  const [page, setPage] = useState(() => {
    const user = localStorage.getItem('user');
    return user ? 'dashboard' : 'login';
  });
  // Custom sidebar navigation handler
  const handleNav = (key) => setPage(key);

  // Hàm logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setPage('login');
  };

  // Clone sidebar and inject navigation handler
  let PageComponent = React.cloneElement(PAGES[page], { onNavigate: handleNav, currentPage: page, onLogout: handleLogout });

  // Nếu chưa đăng nhập thì chỉ cho vào login/register
  const user = localStorage.getItem('user');
  if (!user && page !== 'login' && page !== 'register') {
    PageComponent = React.cloneElement(PAGES['login'], { onNavigate: handleNav });
  }

  return (
    <AppointmentProvider>
      {PageComponent}
    </AppointmentProvider>
  );
}
