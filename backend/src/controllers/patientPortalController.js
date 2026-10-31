import { executeQuery } from '../config/database.js';

export const getMyPatientPortal = async (req, res) => {
  try {
    const patientResult = await executeQuery(
      `SELECT TOP 1
         p.PatientID,
         p.FullName,
         p.DateOfBirth,
         p.Gender,
         p.PhoneNumber,
         p.Email,
         p.Address,
         p.MedicalHistory
       FROM Patients p
       WHERE p.AccountID = @accountId`,
      { accountId: req.user.id },
    );

    const patient = patientResult.recordset[0];
    if (!patient) {
      return res.json({
        success: true,
        data: {
          profile: {
            fullName: req.user.email,
            email: req.user.email,
            patientId: null,
          },
          appointments: [],
          records: [],
        },
      });
    }

    const [appointmentsResult, recordsResult] = await Promise.all([
      executeQuery(
        `SELECT TOP 20
           a.AppointmentID,
           a.AppointmentDate,
           a.AppointmentTime,
           a.Status,
           a.Notes,
           d.FullName AS DoctorName,
           s.SpecialtyName
         FROM Appointments a
         LEFT JOIN Doctors d ON a.DoctorID = d.DoctorID
         LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
         WHERE a.PatientID = @patientId
         ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC`,
        { patientId: patient.PatientID },
      ),
      executeQuery(
        `SELECT TOP 20
           mr.RecordID,
           mr.DiagnosisCode,
           mr.Prescription,
           mr.Notes,
           mr.FollowUpDate,
           mr.CreatedDate
         FROM MedicalRecords mr
         INNER JOIN Appointments a ON mr.AppointmentID = a.AppointmentID
         WHERE a.PatientID = @patientId
         ORDER BY mr.CreatedDate DESC`,
        { patientId: patient.PatientID },
      ),
    ]);

    return res.json({
      success: true,
      data: {
        profile: {
          patientId: patient.PatientID,
          fullName: patient.FullName,
          dateOfBirth: patient.DateOfBirth,
          gender: patient.Gender,
          phone: patient.PhoneNumber,
          email: patient.Email,
          address: patient.Address,
          medicalHistory: patient.MedicalHistory,
        },
        appointments: appointmentsResult.recordset,
        records: recordsResult.recordset,
      },
    });
  } catch (error) {
    console.error('Get patient portal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load the patient portal',
    });
  }
};

export default { getMyPatientPortal };
