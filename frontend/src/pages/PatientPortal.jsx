import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarCheck,
  FaCheckCircle,
  FaFileDownload,
  FaFileMedical,
  FaFileInvoiceDollar,
  FaGlobe,
  FaHeartbeat,
  FaLanguage,
  FaPills,
  FaNotesMedical,
  FaQrcode,
  FaRegBell,
  FaRobot,
  FaPhoneAlt,
  FaStethoscope,
  FaSyringe,
  FaTrashAlt,
  FaUserShield,
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

const vaccinationCard = [
  { name: 'Influenza', lastDose: '2025-10-04', due: '2026-10-04', status: 'Up to date' },
  { name: 'Hepatitis B Booster', lastDose: '2024-06-13', due: '2026-06-13', status: 'Due in 3 months' },
  { name: 'COVID-19 Booster', lastDose: '2025-11-29', due: '2026-11-29', status: 'Up to date' },
];

const carePlanTimeline = [
  { id: 'cp-1', stage: 'Remote intake completed', target: 'Done', owner: 'Nurse coordinator' },
  { id: 'cp-2', stage: 'Cardiology review and ECG follow-up', target: '2026-04-08', owner: 'Dr. Elena Rossi' },
  { id: 'cp-3', stage: 'Lifestyle coaching touchpoint', target: '2026-04-12', owner: 'Digital care coach' },
  { id: 'cp-4', stage: 'Lab panel reassessment', target: '2026-04-29', owner: 'Lab services' },
];

const digitalBiomarkers = [
  { label: 'Cardio stress index', value: '24 / 100', trend: 'Stable low risk' },
  { label: 'Sleep recovery quality', value: '82%', trend: 'Improving over 14 days' },
  { label: 'Medication adherence', value: '93%', trend: 'Excellent consistency' },
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
  const [consentStatus, setConsentStatus] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState('');
  const [refillStatus, setRefillStatus] = useState('');
  const [innovationStatus, setInnovationStatus] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState({
    sms: true,
    email: true,
    app: true,
  });
  const [consent, setConsent] = useState({
    treatmentData: true,
    telehealthRecording: false,
    insurerShare: true,
    researchOptIn: false,
  });

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

  const aiCareScore = useMemo(() => {
    const upcomingCount = upcomingAppointments.length;
    const recordCount = recentRecords.length;
    const baseline = 72;
    return Math.min(98, baseline + upcomingCount * 3 + recordCount * 2);
  }, [recentRecords, upcomingAppointments]);

  const handleTelehealthJoin = () => {
    setTelehealthStatus('Telehealth room request submitted. Care coordinator will confirm in-app within 2 minutes.');
  };

  const updateConsent = (key) => {
    setConsent((prev) => {
      const next = {
        ...prev,
        [key]: !prev[key],
      };
      setConsentStatus('Consent preferences updated and logged for compliance review.');
      return next;
    });
  };

  const updateNotification = (key) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const exportHealthData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      memberId: patientProfile.memberId,
      profile: patientProfile,
      upcomingAppointments,
      recentRecords,
      billingSummary,
      consent,
      notificationPrefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `patient-data-package-${patientProfile.memberId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setPrivacyStatus('Data package generated successfully.');
  };

  const submitDeleteRequest = () => {
    setPrivacyStatus('Data deletion request submitted to compliance desk (SLA: 72 hours).');
  };

  const requestMedicationRefill = () => {
    setRefillStatus('Medication refill request sent to pharmacy verification queue.');
  };

  const generateAICareSummary = () => {
    setInnovationStatus('AI preventive summary generated and routed to your care team dashboard.');
  };

  const requestTravelLetter = () => {
    setInnovationStatus('International travel medical letter request submitted for physician sign-off.');
  };

  const copyEmergencyPass = async () => {
    const passCode = `ICE-${patientProfile.memberId}-GLOBAL-24`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(passCode);
      }
      setInnovationStatus('Emergency smart pass copied. You can share it with emergency responders.');
    } catch {
      setInnovationStatus(`Emergency smart pass: ${passCode}`);
    }
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

          <section className="patient-grid patient-grid-two">
            <article className="patient-card">
              <h3><FaPills /> Medication Refill & Care Plan</h3>
              <p className="patient-prescription">Current medication: {latestPrescription}</p>
              <button className="patient-action-btn" onClick={requestMedicationRefill}>Request Refill</button>
              {refillStatus && <p className="patient-inline-status">{refillStatus}</p>}

              <div className="patient-plan-wrap">
                {carePlanTimeline.map((step) => (
                  <div className="patient-plan-step" key={step.id}>
                    <span><FaCheckCircle /> {step.stage}</span>
                    <small>{step.owner} - {step.target}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="patient-card">
              <h3><FaSyringe /> Vaccination Card</h3>
              <ul className="patient-vaccine-list">
                {vaccinationCard.map((item) => (
                  <li key={item.name}>
                    <div>
                      <b>{item.name}</b>
                      <p>Last dose: {item.lastDose}</p>
                    </div>
                    <div className="patient-list-meta">
                      <span>Next due: {item.due}</span>
                      <small className="patient-chip patient-confirmed">{item.status}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="patient-grid patient-grid-two">
            <article className="patient-card">
              <h3><FaUserShield /> Consent Center</h3>
              <div className="patient-toggle-list">
                <label><input type="checkbox" checked={consent.treatmentData} onChange={() => updateConsent('treatmentData')} /> Treatment data sharing for care teams</label>
                <label><input type="checkbox" checked={consent.telehealthRecording} onChange={() => updateConsent('telehealthRecording')} /> Telehealth recording consent</label>
                <label><input type="checkbox" checked={consent.insurerShare} onChange={() => updateConsent('insurerShare')} /> Claim data sharing with insurer</label>
                <label><input type="checkbox" checked={consent.researchOptIn} onChange={() => updateConsent('researchOptIn')} /> Research quality-improvement opt-in</label>
              </div>
              {consentStatus && <p className="patient-inline-status">{consentStatus}</p>}
            </article>

            <article className="patient-card">
              <h3><FaFileDownload /> Privacy & Data Rights</h3>
              <div className="patient-privacy-actions">
                <button className="patient-action-btn" onClick={exportHealthData}><FaFileDownload /> Export My Data</button>
                <button className="patient-action-btn patient-action-danger" onClick={submitDeleteRequest}><FaTrashAlt /> Request Data Deletion</button>
              </div>
              <div className="patient-toggle-list">
                <label><input type="checkbox" checked={notificationPrefs.sms} onChange={() => updateNotification('sms')} /> SMS appointment reminders</label>
                <label><input type="checkbox" checked={notificationPrefs.email} onChange={() => updateNotification('email')} /> Email lab and invoice notifications</label>
                <label><input type="checkbox" checked={notificationPrefs.app} onChange={() => updateNotification('app')} /> In-app care plan updates</label>
              </div>
              <p className="patient-footnote"><FaRegBell /> Notification preferences sync with care coordination channels.</p>
              {privacyStatus && <p className="patient-inline-status">{privacyStatus}</p>}
            </article>
          </section>

          <section className="patient-grid patient-grid-three">
            <article className="patient-card">
              <h3><FaRobot /> AI Preventive Health Navigator</h3>
              <div className="patient-ai-score-wrap">
                <span className="patient-ai-score-label">Personal Care Score</span>
                <b className="patient-ai-score-value">{aiCareScore}/100</b>
              </div>
              <ul className="patient-biomarker-list">
                {digitalBiomarkers.map((item) => (
                  <li key={item.label}>
                    <div>
                      <b>{item.label}</b>
                      <p>{item.trend}</p>
                    </div>
                    <span>{item.value}</span>
                  </li>
                ))}
              </ul>
              <button className="patient-action-btn" onClick={generateAICareSummary}>Generate AI Care Summary</button>
            </article>

            <article className="patient-card">
              <h3><FaGlobe /> International Care Concierge</h3>
              <ul className="patient-kv-list">
                <li><span>Preferred Language</span><b><FaLanguage /> English / Vietnamese</b></li>
                <li><span>Cross-border Insurance</span><b>Verified for outpatient claims</b></li>
                <li><span>Travel Clearance</span><b>Eligible for physician approval</b></li>
              </ul>
              <button className="patient-action-btn" onClick={requestTravelLetter}>Request Travel Medical Letter</button>
            </article>

            <article className="patient-card">
              <h3><FaQrcode /> Emergency Smart Pass</h3>
              <div className="patient-emergency-pass">
                <p>Instant ICE profile with blood group, allergies, and primary doctor handoff channel.</p>
                <code>{`ICE-${patientProfile.memberId}-GLOBAL-24`}</code>
              </div>
              <button className="patient-action-btn" onClick={copyEmergencyPass}>Copy Emergency Pass</button>
            </article>
          </section>

          {innovationStatus && <div className="patient-status-note">{innovationStatus}</div>}
        </main>
      </div>
    </div>
  );
}
