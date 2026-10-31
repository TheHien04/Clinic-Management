export const OPS_ALERTS_EVENT = 'ops-alerts:update';
export const DASHBOARD_AUTOPILOT_KEY = 'dashboard_autopilot_mode_v1';
export const DASHBOARD_HANDOVER_KEY = 'dashboard_handover_sbar_v1';
export const allowMockFallback = !import.meta.env.PROD;

export const pieColors = Object.freeze(['#087f9b', '#20bfd3', '#dda23d', '#d45d62', '#547aa5']);
export const statusWeight = Object.freeze({ completed: 0, confirmed: 0, pending: 1, cancelled: 2 });
export const statusLabel = Object.freeze({
  completed: 'Completed',
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
});

export const fallbackAppointments = Object.freeze([
  { id: 1, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'confirmed' },
  { id: 2, patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-08-29', time: '10:00', status: 'pending' },
  { id: 3, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-29', time: '11:00', status: 'completed' },
  { id: 4, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-29', time: '13:00', status: 'completed' },
  { id: 5, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'confirmed' },
  { id: 6, patient: 'Nguyen Van B', doctor: 'Dr. John', date: '2025-08-29', time: '15:00', status: 'pending' },
  { id: 7, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-28', time: '08:30', status: 'completed' },
  { id: 8, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-28', time: '11:00', status: 'cancelled' },
]);

export const fallbackPatients = Object.freeze([
  { id: 1, name: 'Nguyen Van A' },
  { id: 2, name: 'Tran Thi B' },
  { id: 3, name: 'Le Van C' },
  { id: 4, name: 'Pham Thi D' },
]);

export const fallbackDoctors = Object.freeze([
  { id: 1, name: 'Dr. Smith' },
  { id: 2, name: 'Dr. John' },
  { id: 3, name: 'Dr. Anna' },
]);

export const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

export const normalizeAppointment = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (item.AppointmentID || item.AppointmentDate) {
    return {
      id: item.AppointmentID,
      date: item.AppointmentDate ? String(item.AppointmentDate).slice(0, 10) : '',
      time: item.AppointmentTime ? String(item.AppointmentTime).slice(0, 5) : '',
      status: normalizeStatus(item.Status),
      patient: item.PatientName || `Patient #${item.PatientID || ''}`,
      doctor: item.DoctorName || `Doctor #${item.DoctorID || ''}`,
      notes: item.Notes || '',
    };
  }
  return {
    id: item.id,
    date: item.date,
    time: item.time,
    status: normalizeStatus(item.status),
    patient: item.patient,
    doctor: item.doctor,
    notes: item.notes || '',
  };
};

export const normalizePerson = (item, fallbackLabel) => {
  if (!item || typeof item !== 'object') return null;
  if (item.PatientID || item.DoctorID) {
    const id = item.PatientID || item.DoctorID;
    return { id, name: item.FullName || `${fallbackLabel} #${id}` };
  }
  return { id: item.id, name: item.name || `${fallbackLabel} #${item.id || ''}` };
};
