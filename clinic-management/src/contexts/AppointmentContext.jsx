import React, { createContext, useContext, useState, useMemo } from 'react';

const AppointmentContext = createContext();

const initialAppointments = [
  { id: 1, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', service: 'General Checkup', fee: 200000, status: 'Confirmed', checkedIn: false },
  { id: 2, patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-08-29', time: '10:00', service: 'Eye Exam', fee: 150000, status: 'Pending', checkedIn: false },
  { id: 3, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-30', time: '08:30', service: 'General Checkup', fee: 200000, status: 'Completed', checkedIn: true },
  { id: 4, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-30', time: '11:00', service: 'Dermatology', fee: 180000, status: 'Cancelled', checkedIn: false },
];

export function AppointmentProvider({ children }) {
  const [appointments, setAppointments] = useState(initialAppointments);

  // Patients & doctors mock (có thể mở rộng sau)
  const patients = useMemo(() => [
    { id: 1, name: 'Nguyen Van A' },
    { id: 2, name: 'Tran Thi B' },
    { id: 3, name: 'Le Van C' },
    { id: 4, name: 'Pham Thi D' },
  ], []);
  const [doctors, setDoctors] = useState([
    { id: 1, name: 'Dr. Smith', specialty: 'Cardiology', status: 'active', contact: 'smith@clinic.com', kpi: { month: 2, rating: 4.8 } },
    { id: 2, name: 'Dr. John', specialty: 'Pediatrics', status: 'active', contact: 'john@clinic.com', kpi: { month: 1, rating: 4.5 } },
    { id: 3, name: 'Dr. Anna', specialty: 'Dermatology', status: 'onleave', contact: 'anna@clinic.com', kpi: { month: 1, rating: 4.7 } },
  ]);

  // CRUD cho bác sĩ
  const addDoctor = (doc) => setDoctors(prev => [...prev, { ...doc, id: prev.length ? Math.max(...prev.map(d=>d.id))+1 : 1 }]);
  const updateDoctor = (id, changes) => setDoctors(prev => prev.map(d => d.id === id ? { ...d, ...(typeof changes === 'function' ? changes(d) : changes) } : d));
  const deleteDoctor = (id) => setDoctors(prev => prev.filter(d => d.id !== id));

  // Thêm, cập nhật, filter, ...
  const addAppointment = (app) => setAppointments(prev => [...prev, { ...app, id: prev.length + 1 }]);
  const updateAppointment = (id, changes) => setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...(typeof changes === 'function' ? changes(a) : changes) } : a));

  return (
    <AppointmentContext.Provider value={{
      appointments, setAppointments, addAppointment, updateAppointment,
      patients,
      doctors, setDoctors, addDoctor, updateDoctor, deleteDoctor
    }}>
      {children}
    </AppointmentContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppointmentContext() {
  return useContext(AppointmentContext);
}
