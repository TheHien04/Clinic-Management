import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { FaHeartbeat, FaUserInjured, FaExclamationTriangle, FaHistory, FaNotesMedical, FaFileExport, FaCheckCircle, FaClipboardCheck, FaEdit, FaSearchPlus } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Spinner from '../components/Spinner';
import Toast from '../components/Toast';
import {
  getMedicalRecordsAPI,
  deleteMedicalRecordAPI,
  createMedicalRecordAPI,
  updateMedicalRecordAPI,
  getMedicalRecordByIdAPI,
  getMedicalRecordsByPatientAPI,
} from '../services/medicalRecords';
import { exportToCSV } from '../utils/exportUtils';
import { formatDateShort } from '../utils/i18nFormat';
import './MedicalRecords.css';
import './Common.css';
import './CareWorkspace.css';

const MOCK_RECORDS = (() => {
  const patients = [
    { id: 11, name: 'Nguyen Van A', dob: '1980-05-12', phone: '0901234567' },
    { id: 12, name: 'Tran Thi B', dob: '1975-08-09', phone: '0902345678' },
    { id: 13, name: 'Le Van C', dob: '2002-01-18', phone: '0903456789' },
    { id: 14, name: 'Pham Thi D', dob: '1969-11-04', phone: '0904567890' },
    { id: 15, name: 'Bui Van E', dob: '1990-03-21', phone: '0905678901' },
    { id: 16, name: 'Do Thi F', dob: '1988-07-30', phone: '0906789012' },
  ];

  const doctors = [
    { name: 'Dr. Smith', specialty: 'Cardiology' },
    { name: 'Dr. John', specialty: 'Internal Medicine' },
    { name: 'Dr. Anna', specialty: 'Respiratory' },
  ];

  const diagnosisTemplates = [
    { code: 'I10', prescription: 'Amlodipine 5mg daily', note: 'Hypertension controlled, monitor BP at home.' },
    { code: 'E11.9', prescription: 'Metformin 500mg BID', note: 'Type 2 diabetes, reinforce nutrition plan.' },
    { code: 'J45.9', prescription: 'Salbutamol inhaler PRN', note: 'Asthma plan reviewed and trigger diary updated.' },
    { code: 'I25.1', prescription: 'Atorvastatin 20mg nightly', note: 'Coronary risk management and lipid follow-up needed.' },
    { code: 'E78.5', prescription: 'Lifestyle + omega-3', note: 'Dyslipidemia, increase exercise and repeat labs.' },
    { code: 'J44.9', prescription: 'Tiotropium inhaler daily', note: 'COPD symptom monitoring and inhaler adherence.' },
  ];

  const statusByIndex = ['completed', 'completed', 'pending', 'completed', 'cancelled', 'completed'];
  const timeByIndex = ['09:00:00', '10:30:00', '14:00:00', '08:45:00', '13:30:00', '16:00:00'];
  const now = new Date();
  const rows = [];
  let recordSeq = 101;

  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    for (let i = 0; i < 6; i += 1) {
      const patient = patients[i % patients.length];
      const doctor = doctors[(i + monthOffset) % doctors.length];
      const dx = diagnosisTemplates[(i + monthOffset * 2) % diagnosisTemplates.length];
      const createdAt = new Date(now.getFullYear(), now.getMonth() - monthOffset, 4 + i * 3);
      const followUpDate = new Date(createdAt);
      followUpDate.setDate(followUpDate.getDate() + 14 + (i % 3) * 7);
      const status = statusByIndex[i % statusByIndex.length];
      const fee = 150000 + ((i + monthOffset) % 5) * 30000;

      rows.push({
        record_id: recordSeq,
        app_id: 800 + recordSeq,
        diagnosis_code: dx.code,
        prescription: dx.prescription,
        notes: dx.note,
        follow_up_date: followUpDate.toISOString().slice(0, 10),
        created_at: createdAt.toISOString().slice(0, 10),
        scheduled_time: `${createdAt.toISOString().slice(0, 10)}T${timeByIndex[i % timeByIndex.length]}`,
        appointment_status: status,
        patient_id: patient.id,
        patient_name: patient.name,
        date_of_birth: patient.dob,
        phone: patient.phone,
        doctor_name: doctor.name,
        specialty_name: doctor.specialty,
        fee,
      });

      recordSeq += 1;
    }
  }

  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
})();

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return formatDateShort(dateString);
};

const getAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const getRiskLevel = (record) => {
  const code = String(record.diagnosis_code || '').toUpperCase();
  const age = getAge(record.date_of_birth) || 0;
  const followUpDate = record.follow_up_date ? new Date(record.follow_up_date) : null;
  const overdueFollowup = followUpDate && followUpDate < new Date();

  let score = 0;
  if (age >= 65) score += 2;
  if (/^(I|C|E1|J4)/.test(code)) score += 2;
  if (overdueFollowup) score += 1;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
};

const getIcdGroup = (code = '') => {
  const prefix = String(code).toUpperCase().charAt(0);
  if (prefix === 'I') return 'Cardiovascular';
  if (prefix === 'E') return 'Endocrine';
  if (prefix === 'J') return 'Respiratory';
  if (prefix === 'C') return 'Oncology';
  return 'Other';
};

const buildVitalsSnapshot = (record) => {
  const age = getAge(record.date_of_birth) || 40;
  const risk = getRiskLevel(record);
  const baseSys = risk === 'high' ? 148 : risk === 'medium' ? 136 : 124;
  const baseDia = risk === 'high' ? 94 : risk === 'medium' ? 86 : 78;
  const pulse = age > 60 ? 82 : 74;
  return {
    bp: `${baseSys}/${baseDia}`,
    pulse,
    temp: risk === 'high' ? '37.6 C' : '36.9 C',
    spo2: risk === 'high' ? '94%' : '98%',
  };
};

const buildLabSnapshot = (record) => {
  const group = getIcdGroup(record.diagnosis_code);
  if (group === 'Cardiovascular') return ['LDL: 145 mg/dL (High)', 'Creatinine: 1.0 mg/dL (Normal)', 'ECG: Sinus rhythm'];
  if (group === 'Endocrine') return ['HbA1c: 7.8% (High)', 'Fasting glucose: 142 mg/dL', 'eGFR: 88 (Normal)'];
  if (group === 'Respiratory') return ['Peak flow: 78% predicted', 'WBC: 8.2 x10^9/L', 'CRP: Mild elevation'];
  return ['CBC: Within normal range', 'Electrolytes: Normal', 'Liver enzymes: Normal'];
};

const buildClinicalInsights = (record, history) => {
  const insights = [];
  const risk = getRiskLevel(record);
  const age = getAge(record.date_of_birth);

  insights.push(`Risk stratification: ${risk.toUpperCase()} based on ICD pattern, age, and follow-up adherence.`);

  if (age && age >= 65) {
    insights.push(`Geriatric watchpoint: patient age ${age}. Consider medication review and fall-risk screening.`);
  }

  const codePrefix = String(record.diagnosis_code || '').toUpperCase().charAt(0);
  if (codePrefix === 'I') insights.push('Cardio pathway: monitor BP trend and reinforce salt restriction counseling.');
  if (codePrefix === 'E') insights.push('Metabolic pathway: schedule HbA1c / glucose follow-up and lifestyle coaching.');
  if (codePrefix === 'J') insights.push('Respiratory pathway: assess symptom triggers and inhaler adherence.');

  if (history.length >= 3) {
    insights.push(`Care continuity: ${history.length} prior record(s) found for this patient.`);
  }

  if (!record.follow_up_date) {
    insights.push('No follow-up date set. Recommend scheduling follow-up before discharge.');
  }

  return insights;
};

export default function MedicalRecords() {
  const initialRole = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = String(user.role || 'doctor').toLowerCase();
      return ['doctor', 'nurse', 'admin'].includes(role) ? role : 'doctor';
    } catch {
      return 'doctor';
    }
  })();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [filter, setFilter] = useState({ search: '', startDate: '', endDate: '', risk: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [detailModal, setDetailModal] = useState({ open: false, loading: false, record: null, history: [] });
  const [roleView, setRoleView] = useState(initialRole);
  const [reviewedRecordIds, setReviewedRecordIds] = useState([]);
  const [formData, setFormData] = useState({
    appId: '',
    diagnosisCode: '',
    prescription: '',
    notes: '',
    followUpDate: ''
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const searchInputRef = useRef(null);
  const trendRef = useRef(null);
  const tableRef = useRef(null);

  // Fetch medical records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined
      };
      
      const response = await getMedicalRecordsAPI(params);
      const isUnfilteredWindow = !params.startDate && !params.endDate;
      const applyDemoFallback = (message) => {
        if (!isUnfilteredWindow) {
          setUsingFallback(false);
          setRecords([]);
          setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
          if (message) {
            setToast({ message, type: 'warning' });
          }
          return;
        }

        setUsingFallback(true);
        setRecords(MOCK_RECORDS);
        setPagination((prev) => ({ ...prev, page: 1, total: MOCK_RECORDS.length, totalPages: 1 }));
        if (message) {
          setToast({ message, type: 'warning' });
        }
      };
      
      if (response.success) {
        const hasServerData = Array.isArray(response.data) && response.data.length > 0;
        // Keep dashboards populated in demo mode when backend is reachable but unseeded.
        if (!hasServerData) {
          applyDemoFallback('No medical records found in backend yet, showing demo dataset.');
        } else {
          setUsingFallback(false);
          setRecords(response.data);
          setPagination(prev => ({
            ...prev,
            total: Number(response.pagination?.total || response.data.length || 0),
            totalPages: Number(response.pagination?.totalPages || 1)
          }));
        }
      } else {
        applyDemoFallback('Medical record service returned no usable data, showing demo dataset.');
      }
    } catch (error) {
      console.error('Fetch records error:', error);
      const hasDateFilter = Boolean(filter.startDate || filter.endDate);
      if (hasDateFilter) {
        setUsingFallback(false);
        setRecords([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
        setToast({ message: 'Backend medical records unavailable for this filtered query.', type: 'warning' });
      } else {
        setUsingFallback(true);
        setRecords(MOCK_RECORDS);
        setPagination((prev) => ({ ...prev, page: 1, total: MOCK_RECORDS.length, totalPages: 1 }));
        setToast({ message: 'Backend medical records unavailable, using demo records.', type: 'warning' });
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filter.startDate, filter.endDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Filter records locally
  const filteredRecords = records.filter((record) => {
    const searchLower = filter.search.toLowerCase();
    const status = String(record.appointment_status || '').toLowerCase();
    const risk = getRiskLevel(record);

    const statusMatch = !filter.status || status === filter.status;
    const riskMatch = !filter.risk || risk === filter.risk;
    const textMatch =
      record.patient_name?.toLowerCase().includes(searchLower) ||
      record.doctor_name?.toLowerCase().includes(searchLower) ||
      record.diagnosis_code?.toLowerCase().includes(searchLower);

    return statusMatch && riskMatch && textMatch;
  });

  const kpi = useMemo(() => {
    const total = filteredRecords.length;
    const highRisk = filteredRecords.filter((r) => getRiskLevel(r) === 'high').length;
    const dueFollowups = filteredRecords.filter((r) => {
      if (!r.follow_up_date) return false;
      return new Date(r.follow_up_date) <= new Date();
    }).length;
    const uniquePatients = new Set(filteredRecords.map((r) => r.patient_name)).size;
    return { total, highRisk, dueFollowups, uniquePatients };
  }, [filteredRecords]);

  const clinicalReviewQueue = useMemo(() => filteredRecords
    .map((record) => {
      const risk = getRiskLevel(record);
      const followupDue = Boolean(record.follow_up_date && new Date(record.follow_up_date) <= new Date());
      const status = String(record.appointment_status || '').toLowerCase();
      const priority = risk === 'high' ? 3 : followupDue ? 2 : status === 'pending' ? 1 : 0;
      return { record, risk, followupDue, status, priority };
    })
    .filter((item) => item.priority > 0 && !reviewedRecordIds.includes(item.record.record_id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8), [filteredRecords, reviewedRecordIds]);

  const qualityReadiness = useMemo(() => {
    const total = filteredRecords.length;
    if (!total) {
      return {
        completenessPct: 0,
        freshnessPct: 0,
        codingCoveragePct: 0,
        followupPlanPct: 0,
        readinessScore: 0,
        readinessTier: 'baseline',
      };
    }

    const now = new Date();
    const freshCutoff = new Date(now);
    freshCutoff.setDate(freshCutoff.getDate() - 30);

    const completeRows = filteredRecords.filter((record) => (
      Boolean(record.patient_name)
      && Boolean(record.doctor_name)
      && Boolean(record.diagnosis_code)
      && Boolean(record.follow_up_date)
      && Boolean(record.scheduled_time || record.created_at)
    )).length;

    const freshRows = filteredRecords.filter((record) => {
      const created = new Date(record.created_at || record.scheduled_time || '');
      return !Number.isNaN(created.getTime()) && created >= freshCutoff;
    }).length;

    const codedRows = filteredRecords.filter((record) => getIcdGroup(record.diagnosis_code) !== 'Other').length;
    const followupPlannedRows = filteredRecords.filter((record) => Boolean(record.follow_up_date)).length;

    const completenessPct = Math.round((completeRows / total) * 100);
    const freshnessPct = Math.round((freshRows / total) * 100);
    const codingCoveragePct = Math.round((codedRows / total) * 100);
    const followupPlanPct = Math.round((followupPlannedRows / total) * 100);

    const readinessScore = Math.round(
      completenessPct * 0.35
      + freshnessPct * 0.2
      + codingCoveragePct * 0.25
      + followupPlanPct * 0.2
    );

    const readinessTier = readinessScore >= 85
      ? 'advanced'
      : readinessScore >= 65
        ? 'strong'
        : 'baseline';

    return {
      completenessPct,
      freshnessPct,
      codingCoveragePct,
      followupPlanPct,
      readinessScore,
      readinessTier,
    };
  }, [filteredRecords]);

  // Handle create/update record
  const handleSaveRecord = async (e) => {
    e.preventDefault();
    
    try {
      if (!formData.diagnosisCode) {
        setToast({ message: 'Diagnosis code is required', type: 'error' });
        return;
      }

      let response;
      if (currentRecord) {
        // Update existing record
        response = await updateMedicalRecordAPI(currentRecord.record_id, formData);
      } else {
        // Create new record
        if (!formData.appId) {
          setToast({ message: 'Appointment ID is required', type: 'error' });
          return;
        }
        response = await createMedicalRecordAPI(formData);
      }

      if (response.success) {
        setToast({ 
          message: currentRecord ? 'Medical record updated successfully' : 'Medical record created successfully', 
          type: 'success' 
        });
        setShowModal(false);
        setCurrentRecord(null);
        setFormData({ appId: '', diagnosisCode: '', prescription: '', notes: '', followUpDate: '' });
        fetchRecords();
      }
    } catch (error) {
      console.error('Save record error:', error);
      setToast({ message: error.response?.data?.message || 'Error saving medical record', type: 'error' });
    }
  };

  // Handle delete record
  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medical record?')) {
      return;
    }

    try {
      const response = await deleteMedicalRecordAPI(id);
      if (response.success) {
        setToast({ message: 'Medical record deleted successfully', type: 'success' });
        fetchRecords();
      }
    } catch (error) {
      console.error('Delete record error:', error);
      setToast({ message: 'Error deleting medical record', type: 'error' });
    }
  };

  // Handle edit record
  const handleEditRecord = (record) => {
    setCurrentRecord(record);
    setFormData({
      appId: record.app_id,
      diagnosisCode: record.diagnosis_code,
      prescription: record.prescription || '',
      notes: record.notes || '',
      followUpDate: record.follow_up_date ? record.follow_up_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleViewDetails = async (record) => {
    setDetailModal({ open: true, loading: true, record: null, history: [] });
    try {
      const [detailRes, historyRes] = await Promise.all([
        getMedicalRecordByIdAPI(record.record_id),
        getMedicalRecordsByPatientAPI(record.patient_id),
      ]);

      const detailed = detailRes?.success ? detailRes.data : record;
      const patientHistory = historyRes?.success ? historyRes.data : [];

      setDetailModal({
        open: true,
        loading: false,
        record: detailed,
        history: patientHistory,
      });
    } catch {
      setDetailModal({
        open: true,
        loading: false,
        record,
        history: records.filter((r) => r.patient_id === record.patient_id),
      });
      setToast({ message: 'Detail endpoint unavailable, showing local details.', type: 'warning' });
    }
  };

  const closeDetailModal = () => setDetailModal({ open: false, loading: false, record: null, history: [] });

  const handlePrintDetail = () => {
    window.print();
  };

  const handleExport = useCallback(() => {
    const exportRows = filteredRecords.map((r) => ({
      record_id: r.record_id,
      patient: r.patient_name,
      doctor: r.doctor_name,
      specialty: r.specialty_name || 'N/A',
      diagnosis_code: r.diagnosis_code,
      risk_level: getRiskLevel(r),
      visit_date: formatDate(r.scheduled_time),
      follow_up_date: formatDate(r.follow_up_date),
      appointment_status: r.appointment_status || 'n/a',
    }));

    exportToCSV(exportRows, `medical_records_${new Date().toISOString().slice(0, 10)}.csv`);
    setToast({ message: 'Medical records exported successfully', type: 'success' });
  }, [filteredRecords]);

  // Pagination controls
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const runMedicalRecordsCommand = useCallback((action) => {
    if (!action) return;

    if (action === 'new') {
      setCurrentRecord(null);
      setShowModal(true);
      return;
    }

    if (action === 'filter-high-risk') {
      setFilter((prev) => ({ ...prev, risk: 'high' }));
      return;
    }

    if (action === 'clear-filters') {
      setFilter({ search: '', startDate: '', endDate: '', risk: '', status: '' });
      return;
    }

    if (action === 'focus-search') {
      searchInputRef.current?.focus();
      return;
    }

    if (action === 'export') {
      handleExport();
      return;
    }

    if (action === 'jump-trend') {
      trendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-table') {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [handleExport]);

  useEffect(() => {
    const urlAction = new URLSearchParams(window.location.search).get('cp_action');
    if (urlAction) {
      runMedicalRecordsCommand(urlAction);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const onCommand = (event) => {
      const action = event?.detail?.action;
      runMedicalRecordsCommand(action);
    };

    window.addEventListener('medical-records:command', onCommand);
    return () => window.removeEventListener('medical-records:command', onCommand);
  }, [runMedicalRecordsCommand]);

  if (loading && records.length === 0) return <Spinner />;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main id="main-content" tabIndex="-1" className="page-content medical-records-content">
          <section className="care-workspace-hero medical-records-hero">
            <div className="care-workspace-copy">
              <span className="care-eyebrow"><FaNotesMedical aria-hidden="true" /> Clinical record intelligence</span>
              <h1>Every record, <em>ready for the next decision.</em></h1>
              <p>Unify longitudinal history, coding quality, patient risk and follow-up pressure in one governed clinical workspace.</p>
              <div className="care-hero-actions">
                <button type="button" className="care-action-primary" onClick={() => trendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Explore clinical signals</button>
                <button type="button" className="care-action-secondary" onClick={handleExport}><FaFileExport aria-hidden="true" /> Export records</button>
              </div>
            </div>
            <div className="care-workspace-metrics" aria-label="Medical record priorities">
              <article><span>Total records</span><b>{kpi.total}</b><small>Current governed scope</small></article>
              <article className="is-critical"><span>High risk</span><b>{kpi.highRisk}</b><small>Clinical review required</small></article>
              <article><span>Follow-up due</span><b>{kpi.dueFollowups}</b><small>Continuity actions</small></article>
            </div>
          </section>
          <h1 className="care-sr-only">Medical Records Intelligence Hub</h1>
          {usingFallback && (
            <div className="alert-box alert-warning mr-alert-gap">
              <FaExclamationTriangle /> Backend data unavailable, currently showing curated demo records.
            </div>
          )}

          <details className="mr-quality-panel mr-quality-disclosure">
            <summary>
              <span><FaClipboardCheck aria-hidden="true" /><b>Record quality check</b><small>Open only when reviewing documentation quality</small></span>
              <span className={`mr-quality-tier mr-quality-tier-${qualityReadiness.readinessTier}`}>{qualityReadiness.readinessScore}/100</span>
            </summary>
            <div className="mr-quality-grid" aria-label="Data quality and compliance readiness">
              <article className="mr-quality-card">
                <p>Record Completeness</p>
                <strong>{qualityReadiness.completenessPct}%</strong>
                <small>Required clinical fields available</small>
              </article>
              <article className="mr-quality-card">
                <p>Data Freshness</p>
                <strong>{qualityReadiness.freshnessPct}%</strong>
                <small>Records updated in last 30 days</small>
              </article>
              <article className="mr-quality-card">
                <p>ICD Coding Coverage</p>
                <strong>{qualityReadiness.codingCoveragePct}%</strong>
                <small>Mapped to recognized ICD groups</small>
              </article>
              <article className="mr-quality-card">
                <p>Follow-up Planning</p>
                <strong>{qualityReadiness.followupPlanPct}%</strong>
                <small>Encounters with follow-up strategy</small>
              </article>
            </div>
          </details>

          <section className="mr-review-workbench" ref={trendRef} aria-labelledby="mr-workbench-title">
            <div className="mr-workbench-head">
              <div><span>Today’s work</span><h3 id="mr-workbench-title">What needs your attention?</h3><p>Choose a task, review the patient, then mark it done.</p></div>
              <button type="button" onClick={() => { setCurrentRecord(null); setShowModal(true); }}>+ New clinical record</button>
            </div>
            <div className="mr-workbench-layout">
              <nav className="mr-task-lanes" aria-label="Record task filters">
                <button type="button" onClick={() => setFilter((prev) => ({ ...prev, risk: 'high', status: '' }))}><FaHeartbeat aria-hidden="true" /><span><b>Review urgent cases</b><small>{kpi.highRisk} waiting</small></span></button>
                <button type="button" onClick={() => { setFilter((prev) => ({ ...prev, risk: '', status: '' })); searchInputRef.current?.focus(); }}><FaHistory aria-hidden="true" /><span><b>Plan follow-ups</b><small>{kpi.dueFollowups} due</small></span></button>
                <button type="button" onClick={() => setFilter((prev) => ({ ...prev, status: 'pending', risk: '' }))}><FaClipboardCheck aria-hidden="true" /><span><b>Finish notes</b><small>Pending records</small></span></button>
              </nav>
              <div className="mr-review-queue">
                <div className="mr-review-queue-head"><b>Next patients</b><small>{clinicalReviewQueue.length} need action</small></div>
                {clinicalReviewQueue.map(({ record, risk, followupDue }) => (
                  <article key={`review-${record.record_id}`}>
                    <span className={`risk-badge risk-${risk}`}>{risk}</span>
                    <div className="mr-review-patient"><b>{record.patient_name} · needs review</b><small>{followupDue ? 'Follow-up is due' : 'Clinical note is pending'} · {record.doctor_name}</small></div>
                    <div className="mr-review-actions">
                      <button type="button" onClick={() => handleViewDetails(record)}><FaSearchPlus aria-hidden="true" /> Review</button>
                      <button type="button" onClick={() => handleEditRecord(record)}><FaEdit aria-hidden="true" /> Update</button>
                      <button type="button" onClick={() => setReviewedRecordIds((current) => [...current, record.record_id])}><FaCheckCircle aria-hidden="true" /> Done</button>
                    </div>
                  </article>
                ))}
                {clinicalReviewQueue.length === 0 && <div className="mr-review-empty"><FaCheckCircle aria-hidden="true" /><span><b>Queue is clear</b><small>No unresolved records in the current filter.</small></span></div>}
              </div>
            </div>
          </section>

          <section className="mr-record-browser" aria-labelledby="mr-record-browser-title">
            <div className="mr-browser-head"><div><span>Patient records</span><h3 id="mr-record-browser-title">Find a record</h3></div><small>{filteredRecords.length} results</small></div>
          <div className="filter-row mr-simple-filters">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search patient, doctor, diagnosis..."
              className="filter-input mr-search-field"
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            />
            <select
              className="filter-select"
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="booked">Booked</option>
            </select>
            <select
              className="filter-select"
              value={filter.risk}
              onChange={(e) => setFilter((prev) => ({ ...prev, risk: e.target.value }))}
            >
              <option value="">All Risk</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + New Record
            </button>
          </div>

          <div className="mr-record-cards">
            {filteredRecords.slice(0, 8).map((record) => (
              <article key={`card-${record.record_id}`}>
                <div className="mr-record-avatar" aria-hidden="true">{String(record.patient_name || 'P').charAt(0)}</div>
                <div className="mr-record-main"><b>{record.patient_name} · record #{record.record_id}</b><small>{record.doctor_name} · visit {formatDate(record.scheduled_time)}</small></div>
                <div className="mr-record-context"><span className="mr-dx-chip">{record.diagnosis_code}</span><span className={`risk-badge risk-${getRiskLevel(record)}`}>{getRiskLevel(record)}</span></div>
                <button type="button" onClick={() => handleViewDetails(record)}>Open record</button>
              </article>
            ))}
            {filteredRecords.length === 0 && <div className="mr-card-empty"><FaSearchPlus aria-hidden="true" /><span><b>No matching record</b><small>Try a patient name, doctor or diagnosis code.</small></span></div>}
          </div>
          </section>

          <details className="mr-registry-disclosure" ref={tableRef}>
            <summary><span><b>Advanced registry</b><small>Dates, role view, export and full data table</small></span><span>{filteredRecords.length} records</span></summary>
            <div className="mr-advanced-tools">
              <label>From <input type="date" value={filter.startDate} onChange={(e) => setFilter(prev => ({ ...prev, startDate: e.target.value }))} /></label>
              <label>To <input type="date" value={filter.endDate} onChange={(e) => setFilter(prev => ({ ...prev, endDate: e.target.value }))} /></label>
              <label>Role <select value={roleView} onChange={(e) => setRoleView(e.target.value)}><option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="admin">Admin</option></select></label>
              <button className="btn-secondary" onClick={handleExport}><FaFileExport /> Export CSV</button>
            </div>
          <div className="table-wrapper mr-table-gap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Diagnosis Code</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Visit Date</th>
                  <th>Follow-up</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="mr-empty-cell">
                      No medical records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.record_id}>
                      <td>{record.record_id}</td>
                      <td>{record.patient_name}</td>
                      <td>{record.doctor_name}</td>
                      <td>{record.specialty_name || 'N/A'}</td>
                      <td><span className="mr-dx-chip">{record.diagnosis_code}</span></td>
                      <td><span className={`risk-badge risk-${getRiskLevel(record)}`}>{getRiskLevel(record)}</span></td>
                      <td><span className="status-badge">{record.appointment_status || 'n/a'}</span></td>
                      <td>{formatDate(record.scheduled_time)}</td>
                      <td>{formatDate(record.follow_up_date)}</td>
                      <td>
                        <div className="mr-action-group">
                          <button className="action-btn mr-action-btn-primary" onClick={() => handleViewDetails(record)} title="View Details">
                            Details
                          </button>
                          <button className="action-btn mr-action-btn-success" onClick={() => handleEditRecord(record)} title="Edit">
                            Edit
                          </button>
                          <button className="action-btn mr-action-btn-danger" onClick={() => handleDeleteRecord(record.record_id)} title="Delete">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination mr-pagination">
              <button 
                onClick={() => handlePageChange(pagination.page - 1)} 
                disabled={pagination.page === 1}
                className={`btn-primary ${pagination.page === 1 ? 'mr-pagination-btn-faded' : ''}`}
              >
                Previous
              </button>
              <span className="mr-pagination-page">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button 
                onClick={() => handlePageChange(pagination.page + 1)} 
                disabled={pagination.page === pagination.totalPages}
                className={`btn-primary ${pagination.page === pagination.totalPages ? 'mr-pagination-btn-faded' : ''}`}
              >
                Next
              </button>
            </div>
          )}
          </details>

          {/* Detail Modal */}
          {detailModal.open && (
            <div className="modal-overlay" onClick={closeDetailModal}>
              <div className="modal-content medical-detail-modal" onClick={(e) => e.stopPropagation()}>
                {detailModal.loading ? (
                  <Spinner />
                ) : detailModal.record ? (
                  <>
                    <h2 className="medical-detail-title">Medical Record #{detailModal.record.record_id}</h2>
                    <div className="medical-detail-grid">
                      <div className="medical-card">
                        <h3>Patient Snapshot</h3>
                        <p><b>Name:</b> {detailModal.record.patient_name}</p>
                        <p><b>Age:</b> {getAge(detailModal.record.date_of_birth) ?? 'N/A'}</p>
                        <p><b>Gender:</b> {detailModal.record.gender || 'N/A'}</p>
                        <p><b>Phone:</b> {detailModal.record.phone || 'N/A'}</p>
                        <p><b>Email:</b> {detailModal.record.email || 'N/A'}</p>
                        <p><b>Insurance:</b> {detailModal.record.bhyt_info || 'N/A'}</p>
                      </div>

                      <div className="medical-card">
                        <h3>Encounter Summary</h3>
                        <p><b>Doctor:</b> {detailModal.record.doctor_name}</p>
                        <p><b>Clinic:</b> {detailModal.record.clinic_name || 'N/A'}</p>
                        <p><b>Specialty:</b> {detailModal.record.specialty_name || 'N/A'}</p>
                        <p><b>Diagnosis:</b> <span className="dx-code">{detailModal.record.diagnosis_code}</span></p>
                        <p><b>Visit Date:</b> {formatDate(detailModal.record.scheduled_time)}</p>
                        <p><b>Follow-up:</b> {formatDate(detailModal.record.follow_up_date)}</p>
                      </div>

                      <div className="medical-card">
                        <h3>Vitals Snapshot</h3>
                        {(() => {
                          const v = buildVitalsSnapshot(detailModal.record);
                          return (
                            <>
                              <p><b>Blood Pressure:</b> {v.bp}</p>
                              <p><b>Pulse:</b> {v.pulse} bpm</p>
                              <p><b>Temperature:</b> {v.temp}</p>
                              <p><b>SpO2:</b> {v.spo2}</p>
                            </>
                          );
                        })()}
                      </div>

                      <div className="medical-card">
                        <h3>Lab Snapshot</h3>
                        <ul className="insight-list">
                          {buildLabSnapshot(detailModal.record).map((line) => <li key={line}>{line}</li>)}
                        </ul>
                      </div>

                      <div className="medical-card medical-card-full">
                        <h3>Treatment Plan</h3>
                        {roleView === 'nurse' ? (
                          <>
                            <p><b>Nursing Focus:</b> medication adherence check, symptom escalation guidance, follow-up reminder.</p>
                            <p><b>Care Notes:</b> {detailModal.record.notes || 'No notes.'}</p>
                          </>
                        ) : (
                          <>
                            <p><b>Prescription:</b> {detailModal.record.prescription || 'No prescription added.'}</p>
                            <p><b>Clinical Notes:</b> {detailModal.record.notes || 'No notes.'}</p>
                          </>
                        )}
                      </div>

                      <div className="medical-card medical-card-full">
                        <h3>AI Clinical Insights (Explainable)</h3>
                        <ul className="insight-list">
                          {buildClinicalInsights(detailModal.record, detailModal.history).map((insight) => (
                            <li key={insight}>{insight}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="medical-card medical-card-full">
                        <h3>Patient Record Timeline</h3>
                        <div className="timeline-list">
                          {detailModal.history.length === 0 ? (
                            <p>No prior records.</p>
                          ) : (
                            detailModal.history.map((item) => (
                              <div key={`${item.record_id}-${item.created_at}`} className="timeline-item">
                                <div className="timeline-date">{formatDate(item.created_at || item.scheduled_time)}</div>
                                <div className="timeline-content">
                                  <div><b>Diagnosis:</b> {item.diagnosis_code}</div>
                                  <div><b>Doctor:</b> {item.doctor_name}</div>
                                  <div><b>Follow-up:</b> {formatDate(item.follow_up_date)}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {roleView === 'admin' && (
                        <div className="medical-card medical-card-full">
                          <h3>Admin Compliance View</h3>
                          <p><b>Record Completeness:</b> {detailModal.record.prescription && detailModal.record.notes ? 'Complete' : 'Needs review'}</p>
                          <p><b>Follow-up SLA:</b> {detailModal.record.follow_up_date ? 'Scheduled' : 'Missing follow-up date'}</p>
                          <p><b>Audit Recommendation:</b> Prioritize high-risk records with overdue follow-up for quality board review.</p>
                        </div>
                      )}
                    </div>
                    <div className="modal-actions mr-modal-actions-end">
                      <button type="button" onClick={handlePrintDetail} className="btn-secondary no-print">Print Summary</button>
                      <button type="button" onClick={closeDetailModal} className="btn-secondary">Close</button>
                    </div>
                  </>
                ) : (
                  <p>No details available.</p>
                )}
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content mr-form-modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="mr-form-title">
                  {currentRecord ? 'Edit Medical Record' : 'Create Medical Record'}
                </h2>
                <form onSubmit={handleSaveRecord}>
                  {!currentRecord && (
                    <div className="form-group">
                      <label>Appointment ID *</label>
                      <input
                        type="number"
                        value={formData.appId}
                        onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
                        className="form-input"
                        required
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Diagnosis Code (ICD-10) *</label>
                    <input
                      type="text"
                      value={formData.diagnosisCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosisCode: e.target.value }))}
                      className="form-input"
                      placeholder="e.g., A00.0, J06.9"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Prescription</label>
                    <textarea
                      value={formData.prescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, prescription: e.target.value }))}
                      className="form-input"
                      rows={3}
                      placeholder="Medication details..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Medical Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="form-input"
                      rows={4}
                      placeholder="Doctor's notes..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, followUpDate: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="modal-actions mr-modal-actions-spaced">
                    <button type="button" onClick={() => { setShowModal(false); setCurrentRecord(null); }} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      {currentRecord ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </main>
      </div>
    </div>
  );
}
