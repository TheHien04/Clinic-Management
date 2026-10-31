import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeQueryMock = vi.fn();
const emitAppointmentCreatedMock = vi.fn();

vi.mock('../../../src/config/database.js', () => ({
  executeQuery: executeQueryMock,
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitAppointmentCreated: emitAppointmentCreatedMock,
  emitAppointmentUpdated: vi.fn(),
  emitAppointmentDeleted: vi.fn(),
}));

const { createAppointment } = await import('../../../src/controllers/appointmentController.js');

const createRes = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('appointment controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates new appointments in the governed pending state', async () => {
    executeQueryMock
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ AppointmentID: 501, Status: 'pending' }] })
      .mockResolvedValueOnce({ recordset: [{ AppointmentID: 501, Status: 'pending' }] });

    const req = {
      body: {
        patientId: 10,
        doctorId: 20,
        appointmentDate: '2027-01-15',
        appointmentTime: '09:30:00',
        notes: 'Synthetic controller test',
      },
      user: { clinicId: 3 },
    };
    const res = createRes();

    await createAppointment(req, res);

    const insertCall = executeQueryMock.mock.calls.find(([query]) => String(query).includes('INSERT INTO Appointments'));
    expect(insertCall?.[0]).toContain("'pending'");
    expect(insertCall?.[0]).not.toContain("'booked'");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(emitAppointmentCreatedMock).toHaveBeenCalledWith(expect.objectContaining({ AppointmentID: 501 }));
  });
});
