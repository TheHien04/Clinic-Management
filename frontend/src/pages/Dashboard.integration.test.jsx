import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
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
    Legend: Mock,
  };
});

describe('Dashboard integration', () => {
  it('renders health ops insights and warning signals', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Health Operations Command Center')).toBeTruthy();
    expect(screen.getByText('AI Health Ops Insights')).toBeTruthy();
    expect(screen.getByText('Queue Pressure')).toBeTruthy();
    expect(screen.getByText('Throughput Alert')).toBeTruthy();
    expect(screen.getByText('Cancellation Pulse')).toBeTruthy();
    expect(screen.getByText('Mission Control Queue')).toBeTruthy();
    expect(screen.getByText('Live Operations Feed')).toBeTruthy();
    expect(screen.getByText('Autopilot Scenarios')).toBeTruthy();
  });

  it('ingests realtime ops alert event into live feed', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('ops-alerts:update', {
        detail: {
          total: 1,
          critical: 1,
          alerts: [
            {
              id: 'ops-alert-test',
              severity: 'critical',
              title: 'Doctor overload warning',
              detail: 'Capacity reached threshold',
              at: '2026-03-17T10:15:00.000Z',
            },
          ],
        },
      }));
      await Promise.resolve();
    });

    expect(screen.getByText('Alert: Doctor overload warning')).toBeTruthy();
    expect(screen.getByText('Capacity reached threshold')).toBeTruthy();
  });
});
