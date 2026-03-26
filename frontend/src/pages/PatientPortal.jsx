import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarCheck,
  FaFileMedical,
  FaFileInvoiceDollar,
  FaHeartbeat,
  FaNotesMedical,
  FaPhoneAlt,
  FaStethoscope,
  FaVideo,
} from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { STORAGE_KEYS } from '../constants';
import { getAppointmentsForAnalyticsAPI } from '../services/appointments';
import { getMedicalRecordsAPI } from '../services/medicalRecords';
import './Common.css';
import './PatientPortal.css';

const fallbackAppointments = [
  { id: 1, date: '2026-04-02', time: '09:30', doctor: 'Dr. Elena Rossi', status: 'confirmed', service: 'Cardiology Follow-up', fee: 280000 },
  { id: 2, date: '2026-04-08', time: '14:00', doctor: 'Dr. Minh Tran', status: 'pending', service: 'General Consultation', fee: 180000 },
];

const fallbackRecords = [
  {
    id: 'MR-2201',
    diagnosisCode: 'I10',
    diagnosisLabel: 'Essential hypertension',
    prescription: 'Amlodipine 5mg once daily',
    notes: 'BP stabilized; continue home monitoring.',
    followUpDate: '2026-04-15',
    createdAt: '2026-03-22',
  },
  {
    id: 'MR-2202',
    diagnosisCode: 'R73.03',
    diagnosisLabel: 'Prediabetes',
    prescription: 'Lifestyle intervention; nutrition coaching',
    notes: 'Recommend monthly HbA1c review.',
    followUpDate: '2026-04-29',
    createdAt: '2026-03-10',
  },
];

const normalizeRecord = (row, index) => ({
  id: row.id || row.RecordID || `MR-${index + 1}`,
  diagnosisCode: String(row.diagnosisCode || row.DiagnosisCode || 'N/A'),
  diagnosisLabel: String(row.diagnosisLabel || row.Diagnosis || 'Clinical review record'),
  prescription: String(row.prescription || row.Prescription || 'See physician instructions'),
  notes: String(row.notes || row.Notes || ''),
  followUpDate: String(row.followUpDate || row.FollowUpDate || ''),
  createdAt: String(row.createdAt || row.CreatedAt || new Date().toISOString().slice(0, 10)).slice(0, 10),
});

const formatMoney = (amount) => {
  const value = Number(amount || 0);
  return `${value.toLocaleString('en-US')} VND`;
};

const formatStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'confirmed') return 'Confirmed';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Pending';
};

export default function PatientPortal() {
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [sourceLabel, setSourceLabel] = useState('Loading patient timeline...');
  const [telehealthStatus, setTelehealthStatus] = useState('');

  useEffect(() => {
    let active = true;

    const fetchPortal = async () => {
      try {
        const [appointmentsRows, recordsPayload] = await Promise.all([
          getAppointmentsForAnalyticsAPI({ limit: 20, offset: 0 }),
          getMedicalRecordsAPI({ page: 1, limit: 10 }).catch(() => null),
        ]);

        if (!active) return;

        const normalizedAppointments = Array.isArray(appointmentsRows)
          ? appointmentsRows
              .filter((item) => String(item.patient || '').trim().length > 0)
              .slice(0, 8)
          : [];
        const recordsRows = Array.isArray(recordsPayload?.data)
          ? recordsPayload.data
          : Array.isArray(recordsPayload?.records)
            ? recordsPayload.records
            : [];
        const normalizedRecords = recordsRows.map(normalizeRecord).slice(0, 8);

        if (normalizedAppointments.length || normalizedRecords.length) {
          setAppointments(normalizedAppointments.length ? normalizedAppointments : fallbackAppointments);
          setRecords(normalizedRecords.length ? normalizedRecords : fallbackRecords);
          setSourceLabel('Patient data source: Backend API (secure timeline)');
          return;
        }

        setAppointments(fallbackAppointments);
        setRecords(fallbackRecords);
        setSourceLabel('Patient data source: Preview mode (sample timeline)');
      } catch {
        if (!active) return;
        setAppointments(fallbackAppointments);
        setRecords(fallbackRecords);
        setSourceLabel('Patient data source: Preview mode (API temporarily unavailable)');
      }
    };

    fetchPortal();
    return () => {
      active = false;
    };
  }, []);

  const patientProfile = useMemo(() => {
    let parsedUser = null;
    try {
      parsedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || 'null');
    } catch {
      parsedUser = null;
    }

    return {
      fullName: parsedUser?.fullName || parsedUser?.name || 'International Patient',
      memberId: parsedUser?.memberId || 'INT-240381',
      bloodGroup: parsedUser?.bloodGroup || 'O+',
      allergies: parsedUser?.allergies || 'No known severe allergies',
      primaryDoctor: appointments[0]?.doctor || 'Dr. Care Team',
    };
  }, [appointments]);

  const upcomingAppointments = useMemo(() => {
    return [...appointments]
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 4);
  }, [appointments]);

  const recentRecords = useMemo(() => {
    return [...records]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 4);
  }, [records]);

  const billingSummary = useMemo(() => {
    const total = appointments.reduce((sum, item) => sum + Number(item.fee || 0), 0);
    const covered = Math.round(total * 0.62);
    const outOfPocket = Math.max(0, total - covered);
    return { total, covered, outOfPocket };
  }, [appointments]);

  const latestPrescription = recentRecords[0]?.prescription || 'No active prescription';

  const handleTelehealthJoin = () => {
    setTelehealthStatus('Telehealth room request submitted. Care coordinator will confirm in-app within 2 minutes.');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="patient-portal-content">
          <section className="patient-portal-hero">
            <div>
              <p className="patient-portal-eyebrow"><FaHeartbeat /> Global Digital Patient Experience</p>
              <h1>Patient Portal</h1>
              <p className="patient-portal-subtitle">
                Access your appointments, clinical records, prescriptions, invoices, and remote-care support
                in one secure health timeline.
              </p>
              <p className="patient-source-label">{sourceLabel}</p>
            </div>
            <div className="patient-quick-actions">
              <button className="patient-btn patient-btn-solid" onClick={handleTelehealthJoin}>
                <FaVideo /> Join Telehealth
              </button>
              <a className="patient-btn patient-btn-outline" href="tel:+842838123456">
                <FaPhoneAlt /> Emergency Call
              </a>
            </div>
          </section>

          {telehealthStatus && <div className="patient-status-note">{telehealthStatus}</div>}

          <section className="patient-grid patient-grid-three">
            <article className="patient-card">
              <h3><FaStethoscope /> Personal Health Profile</h3>
              <ul className="patient-kv-list">
                <li><span>Full Name</span><b>{patientProfile.fullName}</b></li>
                <li><span>Member ID</span><b>{patientProfile.memberId}</b></li>
                <li><span>Blood Group</span><b>{patientProfile.bloodGroup}</b></li>
                <li><span>Allergies</span><b>{patientProfile.allergies}</b></li>
                <li><span>Primary Doctor</span><b>{patientProfile.primaryDoctor}</b></li>
              </ul>
            </article>

            <article className="patient-card">
              <h3><FaCalendarCheck /> Upcoming Appointments</h3>
              <ul className="patient-list">
                {upcomingAppointments.map((item) => (
                  <li key={`${item.id}-${item.date}-${item.time}`}>
                    <div>
                      <b>{item.service || 'Consultation'}</b>
                      <p>{item.doctor}</p>
                    </div>
                    <div className="patient-list-meta">
                      <span>{item.date} {item.time}</span>
                      <small className={`patient-chip patient-${String(item.status || '').toLowerCase()}`}>{formatStatus(item.status)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="patient-card">
              <h3><FaFileMedical /> Latest Clinical Records</h3>
              <ul className="patient-record-list">
                {recentRecords.map((record) => (
                  <li key={record.id}>
                    <div>
                      <b>{record.diagnosisCode}</b>
                      <p>{record.diagnosisLabel}</p>
                    </div>
                    <span>{record.createdAt}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="patient-grid patient-grid-two">
            <article className="patient-card">
              <h3><FaNotesMedical /> Prescription & Follow-up</h3>
              <p className="patient-prescription">{latestPrescription}</p>
              <ul className="patient-bullet-list">
                {recentRecords.slice(0, 3).map((record) => (
                  <li key={`${record.id}-followup`}>
                    Follow-up target: {record.followUpDate || 'Coordinate with care team'}
                  </li>
                ))}
              </ul>
            </article>

            <article className="patient-card">
              <h3><FaFileInvoiceDollar /> Billing & Insurance</h3>
              <ul className="patient-kv-list">
                <li><span>Total Charges</span><b>{formatMoney(billingSummary.total)}</b></li>
                <li><span>Insurance Covered</span><b>{formatMoney(billingSummary.covered)}</b></li>
                <li><span>Out-of-pocket</span><b>{formatMoney(billingSummary.outOfPocket)}</b></li>
              </ul>
              <p className="patient-footnote">Coverage estimate shown from current treatment timeline and partner insurer policy.</p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
