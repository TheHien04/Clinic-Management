import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PatientPortal from './PatientPortal';

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../services/appointments', () => ({
  getAppointmentsForAnalyticsAPI: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/medicalRecords', () => ({
  getMedicalRecordsAPI: vi.fn().mockResolvedValue(null),
}));

describe('PatientPortal integration', () => {
  it('renders patient-facing international features', async () => {
    render(
      <MemoryRouter>
        <PatientPortal />
      </MemoryRouter>
    );

    expect(await screen.findByText('Patient Portal')).toBeTruthy();
    expect(screen.getByText('Personal Health Profile')).toBeTruthy();
    expect(screen.getByText('Upcoming Appointments')).toBeTruthy();
    expect(screen.getByText('Latest Clinical Records')).toBeTruthy();
    expect(screen.getByText('Prescription & Follow-up')).toBeTruthy();
    expect(screen.getByText('Billing & Insurance')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Join Telehealth/i })).toBeTruthy();
  });
});
