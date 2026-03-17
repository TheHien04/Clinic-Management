import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Doctors from './Doctors';

const updateDoctorMock = vi.fn();
const addDoctorMock = vi.fn();
const deleteDoctorMock = vi.fn();
const getDoctorsIntelligenceAPIMock = vi.fn();
const applyDoctorsRebalanceAPIMock = vi.fn();

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../components/RadarChart', () => ({
  default: () => <div>DoctorRadarChart</div>,
}));

vi.mock('../components/DoctorPieCharts', () => ({
  default: () => <div>DoctorPieCharts</div>,
}));

vi.mock('../components/AvatarIcon', () => ({
  default: () => <span>Avatar</span>,
}));

vi.mock('../components/Toast', () => ({
  default: ({ message }) => <div>{message || ''}</div>,
}));

vi.mock('../components/Spinner', () => ({
  default: () => null,
}));

vi.mock('../components/DoctorForm', () => ({
  default: () => null,
}));

vi.mock('../components/DoctorSchedule', () => ({
  default: () => null,
}));

vi.mock('../services/doctors', () => ({
  getDoctorsIntelligenceAPI: (...args) => getDoctorsIntelligenceAPIMock(...args),
  applyDoctorsRebalanceAPI: (...args) => applyDoctorsRebalanceAPIMock(...args),
}));

vi.mock('recharts', () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Tooltip: Mock,
    CartesianGrid: Mock,
  };
});

vi.mock('../contexts/AppointmentContext', () => ({
  useAppointmentContext: () => ({
    appointments: [
      { id: 1, doctor: 'Dr. Smith', patient: 'A', status: 'Pending', date: '2025-08-30', time: '09:00' },
      { id: 2, doctor: 'Dr. Smith', patient: 'B', status: 'Pending', date: '2025-08-30', time: '09:30' },
      { id: 3, doctor: 'Dr. Smith', patient: 'C', status: 'Cancelled', date: '2025-08-30', time: '10:00' },
      { id: 4, doctor: 'Dr. Smith', patient: 'D', status: 'Completed', date: '2025-08-30', time: '10:30' },
      { id: 5, doctor: 'Dr. Mai', patient: 'E', status: 'Completed', date: '2025-08-30', time: '11:00' },
    ],
    addDoctor: addDoctorMock,
    updateDoctor: updateDoctorMock,
    deleteDoctor: deleteDoctorMock,
  }),
}));

describe('Doctors integration', () => {
  const scrollIntoViewMock = vi.fn();
  const renderDoctors = async () => {
    render(<Doctors />);
    await act(async () => {
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    updateDoctorMock.mockClear();
    applyDoctorsRebalanceAPIMock.mockClear();
    getDoctorsIntelligenceAPIMock.mockResolvedValue(null);
    applyDoctorsRebalanceAPIMock.mockRejectedValue(new Error('api unavailable'));
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    scrollIntoViewMock.mockClear();
  });

  it('renders capacity intelligence sections', async () => {
    await renderDoctors();

    expect(screen.getByText('Capacity Intelligence Board')).toBeTruthy();
    expect(screen.getByText('Shift Rebalance Queue')).toBeTruthy();
    expect(screen.getByText('Auto-Balance Shift Plan')).toBeTruthy();
  });

  it('runs auto-balance shift plan', async () => {
    await renderDoctors();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /auto-balance shift plan/i }));
      await Promise.resolve();
    });

    expect(updateDoctorMock).toHaveBeenCalled();
  });

  it('uses backend rebalance when API apply succeeds', async () => {
    applyDoctorsRebalanceAPIMock.mockResolvedValue({
      success: true,
      data: {
        movedAppointments: 2,
        intelligence: {
          capacityRows: [],
          cohorts: {},
          rebalanceQueue: [],
        },
      },
    });

    await renderDoctors();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /auto-balance shift plan/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(applyDoctorsRebalanceAPIMock).toHaveBeenCalled();
    });

    expect(updateDoctorMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Auto-balance persisted in backend/i)).toBeTruthy();
  });

  it('handles doctors command event for jump-capacity', async () => {
    await renderDoctors();

    window.dispatchEvent(new CustomEvent('doctors:command', { detail: { action: 'jump-capacity' } }));
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
