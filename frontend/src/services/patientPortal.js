import apiClient from './api';

const toDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const toTime = (value) => {
  if (!value) return '';
  const match = String(value).match(/\b(\d{2}:\d{2})/);
  return match ? match[1] : String(value).slice(0, 5);
};

export const getMyPatientPortalAPI = async () => {
  const response = await apiClient.get('/patient-portal/me');
  const payload = response.data || {};
  return {
    profile: payload.profile || {},
    appointments: (payload.appointments || []).map((item) => ({
      id: item.AppointmentID,
      date: toDate(item.AppointmentDate),
      time: toTime(item.AppointmentTime),
      status: String(item.Status || 'pending').toLowerCase(),
      doctor: item.DoctorName || 'Care team',
      service: item.SpecialtyName || 'General consultation',
      notes: item.Notes || '',
    })),
    records: (payload.records || []).map((item) => ({
      id: item.RecordID,
      diagnosisCode: item.DiagnosisCode || 'N/A',
      diagnosisLabel: 'Clinical review record',
      prescription: item.Prescription || 'See physician instructions',
      notes: item.Notes || '',
      followUpDate: toDate(item.FollowUpDate),
      createdAt: toDate(item.CreatedDate),
    })),
  };
};

export default { getMyPatientPortalAPI };
