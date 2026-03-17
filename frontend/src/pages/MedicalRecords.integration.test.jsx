import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MedicalRecords from './MedicalRecords';

const getMedicalRecordsAPIMock = vi.fn();
const getMedicalRecordByIdAPIMock = vi.fn();
const getMedicalRecordsByPatientAPIMock = vi.fn();
const createMedicalRecordAPIMock = vi.fn();
const updateMedicalRecordAPIMock = vi.fn();
const deleteMedicalRecordAPIMock = vi.fn();
const exportToCSVMock = vi.fn();
let consoleErrorSpy;

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../services/medicalRecords', () => ({
  getMedicalRecordsAPI: (...args) => getMedicalRecordsAPIMock(...args),
  getMedicalRecordByIdAPI: (...args) => getMedicalRecordByIdAPIMock(...args),
  getMedicalRecordsByPatientAPI: (...args) => getMedicalRecordsByPatientAPIMock(...args),
  createMedicalRecordAPI: (...args) => createMedicalRecordAPIMock(...args),
  updateMedicalRecordAPI: (...args) => updateMedicalRecordAPIMock(...args),
  deleteMedicalRecordAPI: (...args) => deleteMedicalRecordAPIMock(...args),
}));

vi.mock('../utils/exportUtils', () => ({
  exportToCSV: (...args) => exportToCSVMock(...args),
}));

describe('MedicalRecords integration', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    getMedicalRecordsAPIMock.mockRejectedValue(new Error('api unavailable'));
    getMedicalRecordByIdAPIMock.mockResolvedValue({
      success: true,
      data: {
        record_id: 101,
        diagnosis_code: 'I10',
        patient_name: 'Nguyen Van A',
        doctor_name: 'Dr. Smith',
        specialty_name: 'Cardiology',
        date_of_birth: '1980-05-12',
        phone: '0901234567',
        prescription: 'Amlodipine 5mg daily',
        notes: 'Hypertension controlled',
        follow_up_date: '2026-04-20',
        scheduled_time: '2026-03-10T09:00:00',
      },
    });
    getMedicalRecordsByPatientAPIMock.mockResolvedValue({
      success: true,
      data: [
        {
          record_id: 101,
          diagnosis_code: 'I10',
          doctor_name: 'Dr. Smith',
          follow_up_date: '2026-04-20',
          created_at: '2026-03-10',
        },
      ],
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('shows fallback warning when medical-record API is unavailable', async () => {
    render(<MedicalRecords />);

    await waitFor(() => {
      expect(screen.getByText('Backend data unavailable, currently showing curated demo records.')).toBeTruthy();
    });
  });

  it('filters high-risk records from API dataset', async () => {
    getMedicalRecordsAPIMock.mockResolvedValueOnce({
      success: true,
      data: [
        {
          record_id: 201,
          app_id: 901,
          diagnosis_code: 'I10',
          follow_up_date: '2026-04-20',
          created_at: '2026-03-10',
          scheduled_time: '2026-03-10T09:00:00',
          appointment_status: 'completed',
          patient_id: 21,
          patient_name: 'High Risk A',
          date_of_birth: '1940-05-12',
          doctor_name: 'Dr. Smith',
          specialty_name: 'Cardiology',
        },
        {
          record_id: 202,
          app_id: 902,
          diagnosis_code: 'J45.9',
          follow_up_date: '2026-03-18',
          created_at: '2026-03-13',
          scheduled_time: '2026-03-13T14:00:00',
          appointment_status: 'completed',
          patient_id: 22,
          patient_name: 'Medium Risk B',
          date_of_birth: '2002-01-18',
          doctor_name: 'Dr. Anna',
          specialty_name: 'Respiratory',
        },
      ],
      pagination: {
        total: 2,
        totalPages: 1,
      },
    });

    render(<MedicalRecords />);

    await waitFor(() => {
      expect(screen.getByText('High Risk A')).toBeTruthy();
      expect(screen.getByText('Medium Risk B')).toBeTruthy();
    });

    const riskSelect = screen.getByDisplayValue('All Risk');
    fireEvent.change(riskSelect, { target: { value: 'high' } });

    await waitFor(() => {
      expect(screen.getByText('High Risk A')).toBeTruthy();
      expect(screen.queryByText('Medium Risk B')).toBeNull();
    });
  });

  it('opens detail modal and renders admin compliance section', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));

    render(<MedicalRecords />);

    const patientCells = await screen.findAllByText('Nguyen Van A');
    expect(patientCells.length).toBeGreaterThan(0);

    const row = patientCells[0].closest('tr');
    expect(row).toBeTruthy();
    const detailsButton = within(row).getByRole('button', { name: /details/i });
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByText('Medical Record #101')).toBeTruthy();
      expect(screen.getByText('Admin Compliance View')).toBeTruthy();
      expect(screen.getByText(/Record Completeness:/)).toBeTruthy();
    });
  });
});
