import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Patients from './Patients';

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../components/PatientModal', () => ({
  default: () => null,
}));

vi.mock('../components/PatientForm', () => ({
  default: () => null,
}));

vi.mock('../services/patients', () => ({
  getPatientsAPI: vi.fn().mockRejectedValue(new Error('offline test fixture')),
  getPatientIntelligenceAPI: vi.fn().mockRejectedValue(new Error('offline test fixture')),
}));

vi.mock('../services/appointments', () => ({
  getAppointmentsForAnalyticsAPI: vi.fn().mockRejectedValue(new Error('offline test fixture')),
}));

vi.mock('recharts', () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
    Tooltip: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
  };
});

describe('Patients integration', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    window.history.pushState({}, '', '/patients');
  });

  afterEach(() => {
    scrollIntoViewMock.mockClear();
  });

  it('renders governed care-priority and outreach sections', async () => {
    render(<Patients />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Patient review cohorts')).toBeTruthy();
    expect(screen.getByText('Clinical data fabric')).toBeTruthy();
    expect(screen.getByText('Proactive Outreach Queue')).toBeTruthy();
    expect(screen.getAllByText('High priority')).toHaveLength(2);
    expect(screen.getByText('Medium priority')).toBeTruthy();
    expect(screen.getByText('Low priority')).toBeTruthy();
  });

  it('applies cp_action focus-high-risk from URL', async () => {
    window.history.pushState({}, '', '/patients?cp_action=focus-high-risk');
    render(<Patients />);

    await act(async () => {
      await Promise.resolve();
    });

    const chronicToggle = screen.getByLabelText(/chronic only/i);
    expect(chronicToggle.checked).toBe(true);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
