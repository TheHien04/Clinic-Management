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

  it('renders precision risk and outreach queue sections', () => {
    render(<Patients />);

    expect(screen.getByText('Precision Patient Risk Cohorts')).toBeTruthy();
    expect(screen.getByText('Proactive Outreach Queue')).toBeTruthy();
    expect(screen.getByText('High Risk')).toBeTruthy();
    expect(screen.getByText('Medium Risk')).toBeTruthy();
    expect(screen.getByText('Low Risk')).toBeTruthy();
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
