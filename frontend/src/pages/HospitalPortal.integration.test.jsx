import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HospitalPortal from './HospitalPortal';

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

describe('HospitalPortal integration', () => {
  it('renders international hospital sections and actions', () => {
    render(
      <MemoryRouter>
        <HospitalPortal />
      </MemoryRouter>
    );

    expect(screen.getByText('Global Hospital Portal')).toBeTruthy();
    expect(screen.getByText('Address & Campus')).toBeTruthy();
    expect(screen.getByText('Emergency Contacts')).toBeTruthy();
    expect(screen.getByText('Core Clinical Services')).toBeTruthy();
    expect(screen.getByText('International Patient Services')).toBeTruthy();
    expect(screen.getByText('Digital Care Experience')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Book Appointment/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Find Specialist/i })).toBeTruthy();
  });
});
