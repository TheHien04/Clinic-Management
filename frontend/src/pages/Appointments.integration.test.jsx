import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Appointments from './Appointments';

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../components/StackedBarStatusChart', () => ({
  default: () => <div>StackedBarStatusChart</div>,
}));

vi.mock('../components/AppointmentCalendarChart', () => ({
  default: () => <div>AppointmentCalendarChart</div>,
}));

vi.mock('../components/AppointmentSankeyChart', () => ({
  default: () => <div>AppointmentSankeyChart</div>,
}));

vi.mock('../components/DonutChart', () => ({
  default: () => <div>DonutChart</div>,
}));

describe('Appointments integration', () => {
  const renderAppointments = () => {
    return render(
      <MemoryRouter>
        <Appointments />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('confirms a pending appointment', async () => {
    renderAppointments();

    expect(screen.getByText('Smart Queue Orchestrator')).toBeTruthy();
    expect(screen.getByText('Auto-Rebook Cancelled')).toBeTruthy();

    const confirmButtons = screen.getAllByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButtons[0]);

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('Appointment confirmed! Notification sent to patient.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /check-in/i }).length).toBeGreaterThan(0);
  });

  it('creates a new appointment from modal form', async () => {
    renderAppointments();

    fireEvent.click(screen.getByRole('button', { name: /book new appointment/i }));

    fireEvent.change(screen.getByPlaceholderText('Patient Name'), {
      target: { value: 'Test Patient Integration' },
    });

    const dateInput = screen.getByPlaceholderText('Patient Name').closest('form')?.querySelector('input[type="date"]');
    const timeInput = screen.getByPlaceholderText('Patient Name').closest('form')?.querySelector('input[type="time"]');

    expect(dateInput).toBeTruthy();
    expect(timeInput).toBeTruthy();

    fireEvent.change(dateInput, { target: { value: '2026-01-01' } });
    fireEvent.change(timeInput, { target: { value: '08:45' } });

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test.patient@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Phone'), {
      target: { value: '0900000000' },
    });

    const modalBookButton = screen.getAllByRole('button', { name: 'Book' })[0];
    fireEvent.click(modalBookButton);

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getAllByText('Test Patient Integration').length).toBeGreaterThan(0);
  });
});
