import { describe, expect, it } from 'vitest';
import { normalizeAppointment, normalizePerson } from './dashboardData';

describe('dashboardData', () => {
  it('normalizes SQL appointment rows into the UI contract', () => {
    expect(normalizeAppointment({
      AppointmentID: 7,
      AppointmentDate: '2026-10-25T00:00:00.000Z',
      AppointmentTime: '09:30:00',
      Status: 'CONFIRMED',
      PatientName: 'Ada Patient',
      DoctorName: 'Dr. Lin',
    })).toMatchObject({
      id: 7,
      date: '2026-10-25',
      time: '09:30',
      status: 'confirmed',
      patient: 'Ada Patient',
      doctor: 'Dr. Lin',
    });
  });

  it('normalizes SQL people without leaking backend field names', () => {
    expect(normalizePerson({ PatientID: 12, FullName: 'Grace Tan' }, 'Patient'))
      .toEqual({ id: 12, name: 'Grace Tan' });
  });
});
