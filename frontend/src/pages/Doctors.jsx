// Calendar Modal (mockup)
function CalendarModal({ doctor, onClose }) {
  const calendar = doctor.calendar || {};
  return (
    <div className="patient-modal-overlay">
      <div className="patient-modal">
        <div className="patient-modal-header">
          <h3>Work Calendar: {doctor.name}</h3>
          <button className="patient-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="patient-modal-body">
          <table className="patient-modal-table">
            <thead><tr><th>Date</th><th>Shift</th></tr></thead>
            <tbody>
              {Object.entries(calendar).map(([date, shift],i) => (
                <tr key={i}><td>{date}</td><td>{shift}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="patient-modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
// Mini KPI Bar Chart
function MiniKPIBarChart({ doctors }) {
  const data = doctors.map(d => ({
    name: d.name.replace('Dr. ', ''),
    kpi: d.kpi?.month ?? 0,
  }));

  const formatKpi = (value) => [`${value} appointments`, 'KPI'];

  return (
    <div className="doctors-kpi-wrap">
      <div className="doctors-kpi-title">KPI Comparison (This Month)</div>
      <div className="doctors-kpi-chart-box">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatKpi} />
            <Bar dataKey="kpi" fill="var(--brand-500)" radius={[6, 6, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import DoctorRadarChart from '../components/RadarChart';
import DoctorPieCharts from '../components/DoctorPieCharts';
import AvatarIcon from '../components/AvatarIcon';
import { EditIcon, DeleteIcon, DetailsIcon } from '../components/icons';
import Toast from '../components/Toast';
import Spinner from '../components/Spinner';
import './Doctors.css';
import DoctorForm from '../components/DoctorForm';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DoctorSchedule from '../components/DoctorSchedule';
import { useAppointmentContext } from '../contexts/AppointmentContext';
import { applyDoctorsRebalanceAPI, getDoctorsIntelligenceAPI } from '../services/doctors';
import { exportToCSV } from '../utils/exportUtils';
import { formatTimeShort } from '../utils/i18nFormat';

const REBALANCE_AUDIT_STORAGE_KEY = 'doctors_rebalance_audit_v1';
const CRITICAL_ALERT_LEDGER_KEY = 'doctors_critical_alert_ledger_v1';
const CRITICAL_ALERT_ACK_KEY = 'doctors_critical_alert_ack_v1';
const OPS_ALERTS_EVENT = 'ops-alerts:update';

const normalizeSpecialties = (specialty) => {
  if (Array.isArray(specialty)) return specialty.filter(Boolean);
  return specialty ? [specialty] : [];
};

const appendScheduleNote = (schedule, note) => {
  if (!schedule) return note;
  if (schedule.includes(note)) return schedule;
  return `${schedule} | ${note}`;
};

const explainRebalanceReason = (plan, rowsByDoctorId) => {
  const sourceRow = rowsByDoctorId.get(Number(plan.sourceDoctorId));
  const targetRow = rowsByDoctorId.get(Number(plan.targetDoctorId));

  if (!sourceRow || !targetRow) {
    return 'Matched by available capacity from queue priority.';
  }

  const sameSpecialty = sourceRow.specialties.some((specialty) =>
    targetRow.specialties.includes(specialty)
  );

  const loadDelta = Math.max(0, Number(sourceRow.loadScore || 0) - Number(targetRow.loadScore || 0));
  const pendingGap = Math.max(0, Number(sourceRow.pendingCount || 0) - Number(targetRow.pendingCount || 0));

  if (sameSpecialty && loadDelta >= 20) {
    return `Specialty-compatible move with strong load gap (${loadDelta} pts) and pending gap ${pendingGap}.`;
  }

  if (sameSpecialty) {
    return `Specialty-compatible move to improve queue balance (pending gap ${pendingGap}).`;
  }

  return `Cross-specialty overflow relief, prioritized by lower target load (${targetRow.loadScore}).`;
};

const buildRealtimeAlerts = (capacityRows, rebalanceQueue, lastSyncAt) => {
  const alerts = [];
  const stamp = lastSyncAt || new Date().toISOString();

  capacityRows
    .filter((row) => row.capacityState === 'overloaded')
    .slice(0, 3)
    .forEach((row) => {
      alerts.push({
        id: `overload-${row.id}`,
        severity: 'critical',
        title: `${row.name} is overloaded`,
        detail: `Load ${row.loadScore}, pending ${row.pendingCount}, cancelled ${row.cancelledCount}.`,
        at: stamp,
      });
    });

  rebalanceQueue
    .filter((plan) => !plan.candidate)
    .slice(0, 2)
    .forEach((plan) => {
      alerts.push({
        id: `capacity-gap-${plan.rank}-${plan.source.id || plan.source.name}`,
        severity: 'warning',
        title: `No target found for ${plan.source.name}`,
        detail: 'No same-specialty capacity candidate was detected for this rebalance lane.',
        at: stamp,
      });
    });

  rebalanceQueue
    .filter((plan) => String(plan.eta || '').toLowerCase().includes('same day'))
    .slice(0, 2)
    .forEach((plan) => {
      alerts.push({
        id: `eta-${plan.rank}`,
        severity: 'info',
        title: `Same-day rebalance planned (${plan.source.name})`,
        detail: `Target ${plan.candidate?.name || 'floating pool'} with ${plan.shiftUnits} unit(s).`,
        at: stamp,
      });
    });

  return alerts.slice(0, 8);
};

function Doctors() {
  
  const { appointments, addDoctor, updateDoctor, deleteDoctor } = useAppointmentContext();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [modalDoctor, setModalDoctor] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [loading, setLoading] = useState(false);
  const [remoteIntelligence, setRemoteIntelligence] = useState(null);
  const [autoRefreshIntelligence, setAutoRefreshIntelligence] = useState(true);
  const [intelligenceLastSyncAt, setIntelligenceLastSyncAt] = useState(null);
  const [rebalanceExplainRows, setRebalanceExplainRows] = useState([]);
  const [rebalanceAuditRows, setRebalanceAuditRows] = useState(() => {
    try {
      const raw = sessionStorage.getItem(REBALANCE_AUDIT_STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [criticalAlertLedger, setCriticalAlertLedger] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CRITICAL_ALERT_LEDGER_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [criticalAlertAck, setCriticalAlertAck] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CRITICAL_ALERT_ACK_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const searchInputRef = useRef(null);
  const tableRef = useRef(null);
  const chartsRef = useRef(null);
  const capacityRef = useRef(null);
  const rebalanceRef = useRef(null);

  // Lấy danh sách bác sĩ có lịch sử khám hoặc trong danh sách
  // Mock: enrich doctors with more info
  // Multi-specialty, rating, status history, reviews, calendar
  const baseDoctors = [
    { id: 1, name: 'Dr. Smith', specialty: ['Cardiology','Internal Medicine'], status: 'active', contact: 'smith@clinic.com', kpi: { month: 12, rating: 4.8 }, schedule: 'Mon-Fri 8:00-16:00', statusHistory: ['active'], reviews: ['Very professional!', 'Great with patients.'], calendar: { '2025-08-29': 'Morning', '2025-08-30': 'Afternoon' } },
    { id: 2, name: 'Dr. John', specialty: ['Pediatrics'], status: 'active', contact: 'john@clinic.com', kpi: { month: 8, rating: 4.5 }, schedule: 'Mon-Wed 9:00-17:00', statusHistory: ['active','onleave'], reviews: ['Kids love him!'], calendar: { '2025-08-29': 'Morning' } },
    { id: 3, name: 'Dr. Anna', specialty: ['Dermatology'], status: 'onleave', contact: 'anna@clinic.com', kpi: { month: 1, rating: 4.2 }, schedule: 'Tue-Thu 10:00-15:00', statusHistory: ['active','onleave'], reviews: ['Very knowledgeable.'], calendar: { '2025-08-30': 'Morning' } },
    { id: 4, name: 'Dr. Lee', specialty: ['Orthopedics'], status: 'inactive', contact: 'lee@clinic.com', kpi: { month: 0, rating: 0 }, schedule: 'Mon-Fri 8:00-16:00', statusHistory: ['active','inactive'], reviews: [], calendar: {} },
    { id: 5, name: 'Dr. Mai', specialty: ['Neurology','Internal Medicine'], status: 'active', contact: 'mai@clinic.com', kpi: { month: 5, rating: 4.7 }, schedule: 'Mon-Fri 8:00-16:00', statusHistory: ['active'], reviews: ['Very caring.'], calendar: { '2025-08-29': 'Evening' } },
  ];
  const all = [...baseDoctors];
  appointments.forEach(app => {
    if (!all.find(d => d.name === app.doctor)) {
      all.push({ id: all.length + 1, name: app.doctor, specialty: '', status: 'active', contact: '', kpi: { month: 0, rating: 0 }, schedule: '' });
    }
  });
  const doctorList = all;

  // Lọc nâng cao & tìm kiếm thông minh
  const [statusFilter, setStatusFilter] = useState('');
  const [patientCountFilter, setPatientCountFilter] = useState('');
  const [appointmentCountFilter, setAppointmentCountFilter] = useState('');
  const [kpiFilter, setKpiFilter] = useState('');
  const filtered = doctorList.filter(d => {
    const nameMatch = d.name.toLowerCase().includes(search.toLowerCase());
    const specialtyMatch = !specialtyFilter || (
      Array.isArray(d.specialty)
        ? d.specialty.includes(specialtyFilter)
        : d.specialty === specialtyFilter
    );
    const statusMatch = !statusFilter || d.status === statusFilter;
    const active = d.status !== 'inactive';
    const showStatus = showInactive || active;
    const history = appointments.filter(a => a.doctor === d.name);
    const patientCount = Array.from(new Set(history.map(h => h.patient))).length;
    const appointmentCount = history.length;
    const patientCountMatch = !patientCountFilter || patientCount >= Number(patientCountFilter);
    const appointmentCountMatch = !appointmentCountFilter || appointmentCount >= Number(appointmentCountFilter);
    const kpiMatch = !kpiFilter || (d.kpi && d.kpi.month >= Number(kpiFilter));
    return nameMatch && specialtyMatch && statusMatch && showStatus && patientCountMatch && appointmentCountMatch && kpiMatch;
  });

  // Lấy lịch sử khám của bác sĩ
  const getHistory = useCallback((name) => appointments.filter(a => a.doctor === name), [appointments]);

  const fetchDoctorsIntelligence = useCallback(async () => {
    try {
      const response = await getDoctorsIntelligenceAPI();
      const payload = response?.data || response;

      if (payload?.capacityRows?.length) {
        setRemoteIntelligence(payload);
        setIntelligenceLastSyncAt(new Date().toISOString());
      } else {
        setRemoteIntelligence(null);
      }
      return payload || null;
    } catch {
      setRemoteIntelligence(null);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchDoctorsIntelligence();
  }, [fetchDoctorsIntelligence]);

  useEffect(() => {
    if (!autoRefreshIntelligence) return undefined;

    const intervalId = window.setInterval(() => {
      fetchDoctorsIntelligence();
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshIntelligence, fetchDoctorsIntelligence]);

  const localDoctorCapacityRows = useMemo(() => {
    return doctorList.map((doctor) => {
      const history = getHistory(doctor.name);
      const uniquePatients = Array.from(new Set(history.map((item) => item.patient))).length;
      const pendingCount = history.filter((item) => String(item.status || '').toLowerCase().includes('pending')).length;
      const cancelledCount = history.filter((item) => String(item.status || '').toLowerCase().includes('cancel')).length;
      const monthKpi = Number(doctor.kpi?.month || 0);
      const rating = Number(doctor.kpi?.rating || 0);

      const loadScore = Math.min(100,
        history.length * 8 +
        pendingCount * 11 +
        cancelledCount * 9 +
        monthKpi * 2 +
        (doctor.status === 'onleave' ? 18 : 0) +
        (rating > 0 && rating < 4.3 ? 8 : 0)
      );

      const burnoutBand = loadScore >= 70 ? 'high' : loadScore >= 45 ? 'medium' : 'low';
      const capacityState = loadScore >= 70 ? 'overloaded' : loadScore >= 40 ? 'balanced' : 'available';

      return {
        id: doctor.id,
        name: doctor.name,
        specialties: normalizeSpecialties(doctor.specialty),
        uniquePatients,
        visits: history.length,
        pendingCount,
        cancelledCount,
        loadScore: Math.round(loadScore),
        burnoutBand,
        capacityState,
      };
    }).sort((a, b) => b.loadScore - a.loadScore);
  }, [doctorList, getHistory]);

  const doctorCapacityRows = useMemo(() => {
    if (!remoteIntelligence?.capacityRows?.length) {
      return localDoctorCapacityRows;
    }

    return remoteIntelligence.capacityRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      specialties: Array.isArray(row.specialties) ? row.specialties : normalizeSpecialties(row.specialties),
      uniquePatients: Number(row.uniquePatients || 0),
      visits: Number(row.visits || 0),
      pendingCount: Number(row.pendingCount || 0),
      cancelledCount: Number(row.cancelledCount || 0),
      loadScore: Number(row.loadScore || 0),
      burnoutBand: row.burnoutBand || 'low',
      capacityState: row.capacityState || 'available',
    }));
  }, [localDoctorCapacityRows, remoteIntelligence]);

  const capacityCohorts = useMemo(() => {
    if (remoteIntelligence?.cohorts) {
      return {
        high: {
          count: Number(remoteIntelligence.cohorts.high?.count || 0),
          avg: Number(remoteIntelligence.cohorts.high?.avg || 0),
        },
        medium: {
          count: Number(remoteIntelligence.cohorts.medium?.count || 0),
          avg: Number(remoteIntelligence.cohorts.medium?.avg || 0),
        },
        low: {
          count: Number(remoteIntelligence.cohorts.low?.count || 0),
          avg: Number(remoteIntelligence.cohorts.low?.avg || 0),
        },
      };
    }

    const high = doctorCapacityRows.filter((row) => row.burnoutBand === 'high');
    const medium = doctorCapacityRows.filter((row) => row.burnoutBand === 'medium');
    const low = doctorCapacityRows.filter((row) => row.burnoutBand === 'low');

    const avg = (rows) => rows.length ? Math.round(rows.reduce((sum, row) => sum + row.loadScore, 0) / rows.length) : 0;

    return {
      high: { count: high.length, avg: avg(high) },
      medium: { count: medium.length, avg: avg(medium) },
      low: { count: low.length, avg: avg(low) },
    };
  }, [doctorCapacityRows, remoteIntelligence]);

  const rebalanceRecommendations = useMemo(() => {
    if (remoteIntelligence?.rebalanceQueue?.length) {
      return remoteIntelligence.rebalanceQueue.map((plan) => ({
        rank: Number(plan.rank || 0),
        source: {
          id: plan.sourceDoctorId != null ? Number(plan.sourceDoctorId) : null,
          name: plan.sourceDoctorName,
        },
        candidate: plan.targetDoctorName ? {
          id: plan.targetDoctorId != null ? Number(plan.targetDoctorId) : null,
          name: plan.targetDoctorName,
        } : null,
        shiftUnits: Number(plan.shiftUnits || 0),
        eta: plan.eta || '24h',
      }));
    }

    const overloaded = doctorCapacityRows.filter((row) => row.capacityState === 'overloaded');
    const available = doctorCapacityRows.filter((row) => row.capacityState === 'available');

    return overloaded.map((source, idx) => {
      const candidate = available.find((target) => {
        if (target.id === source.id) return false;
        if (!source.specialties.length || !target.specialties.length) return true;
        return source.specialties.some((spec) => target.specialties.includes(spec));
      });

      return {
        rank: idx + 1,
        source,
        candidate,
        shiftUnits: source.pendingCount > 0 ? Math.min(3, source.pendingCount) : 1,
        eta: source.pendingCount > 2 ? 'Same day' : '24h',
      };
    }).slice(0, 5);
  }, [doctorCapacityRows, remoteIntelligence]);

  const rowsByDoctorId = useMemo(() => {
    return new Map(doctorCapacityRows.map((row) => [Number(row.id), row]));
  }, [doctorCapacityRows]);

  const liveAlerts = useMemo(() => {
    return buildRealtimeAlerts(doctorCapacityRows, rebalanceRecommendations, intelligenceLastSyncAt);
  }, [doctorCapacityRows, rebalanceRecommendations, intelligenceLastSyncAt]);

  const alertsWithAck = useMemo(() => {
    const ackSet = new Set(criticalAlertAck);
    return liveAlerts.map((alert) => ({
      ...alert,
      acknowledged: alert.severity === 'critical' ? ackSet.has(alert.id) : false,
    }));
  }, [criticalAlertAck, liveAlerts]);

  useEffect(() => {
    sessionStorage.setItem(REBALANCE_AUDIT_STORAGE_KEY, JSON.stringify(rebalanceAuditRows));
  }, [rebalanceAuditRows]);

  useEffect(() => {
    sessionStorage.setItem(CRITICAL_ALERT_LEDGER_KEY, JSON.stringify(criticalAlertLedger));
  }, [criticalAlertLedger]);

  useEffect(() => {
    sessionStorage.setItem(CRITICAL_ALERT_ACK_KEY, JSON.stringify(criticalAlertAck));
  }, [criticalAlertAck]);

  useEffect(() => {
    const total = alertsWithAck.length;
    const critical = alertsWithAck.filter((alert) => alert.severity === 'critical' && !alert.acknowledged).length;
    window.dispatchEvent(new CustomEvent(OPS_ALERTS_EVENT, {
      detail: {
        total,
        critical,
        page: 'doctors',
        at: new Date().toISOString(),
        alerts: alertsWithAck.slice(0, 8),
      },
    }));

    if (!critical) return;

    const firstUnseenCritical = alertsWithAck.find(
      (alert) => alert.severity === 'critical' && !alert.acknowledged && !criticalAlertLedger.includes(alert.id)
    );

    if (!firstUnseenCritical) return;

    setToast({ message: `Critical alert: ${firstUnseenCritical.title}`, type: 'error' });
    setCriticalAlertLedger((prev) => [...prev, firstUnseenCritical.id].slice(-40));
  }, [alertsWithAck, criticalAlertLedger]);

  const acknowledgeCriticalAlert = useCallback((alertId) => {
    setCriticalAlertAck((prev) => {
      if (prev.includes(alertId)) return prev;
      return [...prev, alertId].slice(-80);
    });
    setToast({ message: 'Critical alert acknowledged.', type: 'success' });
  }, []);

  const appendRebalanceAuditRows = useCallback((rows, engine) => {
    if (!rows.length) return;

    const stamped = rows.map((row, idx) => ({
      id: `${Date.now()}-${idx}-${row.sourceDoctorId}-${row.targetDoctorId}`,
      runAt: new Date().toISOString(),
      engine,
      ...row,
    }));

    setRebalanceAuditRows((prev) => [...stamped, ...prev].slice(0, 30));
  }, []);

  // CRUD
  const handleAdd = () => { setEditDoctor(null); setShowForm(true); };
  const handleEdit = (d) => { setEditDoctor(d); setShowForm(true); };
  const handleSchedule = (d) => { setScheduleDoctor(d); setShowSchedule(true); };
  const handleSaveSchedule = (sched) => {
    if (scheduleDoctor) updateDoctor(scheduleDoctor.id, { ...scheduleDoctor, schedule: sched });
    setToast({ message: 'Schedule updated!', type: 'success' });
  };
  const handleDelete = async (d) => {
    if (window.confirm('Delete doctor ' + d.name + '?')) {
      setLoading(true);
      await new Promise(r => setTimeout(r, 600));
      deleteDoctor(d.id);
      setToast({ message: 'Doctor deleted!', type: 'success' });
      setLoading(false);
    }
  };
  const handleSave = (data) => {
    setLoading(true);
    setTimeout(() => {
      if (data.id) updateDoctor(data.id, data);
      else addDoctor(data);
      setShowForm(false);
      setToast({ message: 'Doctor saved!', type: 'success' });
      setLoading(false);
    }, 700);
  };

  const handleAutoBalanceShiftPlan = useCallback(() => {
    const run = async () => {
      const plans = rebalanceRecommendations
        .filter((plan) => plan.source?.id && plan.candidate?.id)
        .slice(0, 2)
        .map((plan) => ({
          sourceDoctorId: Number(plan.source.id),
          targetDoctorId: Number(plan.candidate.id),
          shiftUnits: Number(plan.shiftUnits || 1),
        }));

      if (plans.length) {
        try {
          setLoading(true);
          const response = await applyDoctorsRebalanceAPI({ plans, maxPlans: 2 });
          const payload = response?.data || {};
          const backendSnapshot = payload?.intelligence;
          const backendDetails = Array.isArray(payload?.details) ? payload.details : [];

          if (backendSnapshot?.capacityRows?.length) {
            setRemoteIntelligence(backendSnapshot);
            setIntelligenceLastSyncAt(new Date().toISOString());
          } else {
            await fetchDoctorsIntelligence();
          }

          const explainRows = backendDetails.map((item, idx) => ({
              id: `backend-${idx}-${item.sourceDoctorId}-${item.targetDoctorId}`,
              sourceDoctorId: Number(item.sourceDoctorId),
              targetDoctorId: Number(item.targetDoctorId),
              sourceDoctorName: rowsByDoctorId.get(Number(item.sourceDoctorId))?.name || `Doctor #${item.sourceDoctorId}`,
              targetDoctorName: rowsByDoctorId.get(Number(item.targetDoctorId))?.name || `Doctor #${item.targetDoctorId}`,
              shiftUnits: Number(item.shiftUnits || 1),
              moved: Number(item.moved || 0),
              reason: explainRebalanceReason(item, rowsByDoctorId),
            }));

          setRebalanceExplainRows(explainRows);
          appendRebalanceAuditRows(explainRows, 'backend');

          if (payload?.movedAppointments > 0) {
            setToast({ message: `Auto-balance persisted in backend (${payload.movedAppointments} appointment(s) moved).`, type: 'success' });
            return;
          }

          setToast({ message: response?.message || 'Backend rebalance returned no moved appointments.', type: 'success' });
          return;
        } catch {
          // Fallback to local-only balancing logic when backend is unavailable.
        } finally {
          setLoading(false);
        }
      }

      if (!rebalanceRecommendations.length) {
        setRebalanceExplainRows([]);
        setToast({ message: 'No overloaded doctors detected. Shift plan stays idle.', type: 'success' });
        return;
      }

      const topPlans = rebalanceRecommendations.slice(0, 2);
      const explainRows = topPlans.map((plan, idx) => ({
          id: `local-${idx}-${plan.source.id}-${plan.candidate?.id || 'floating'}`,
          sourceDoctorId: Number(plan.source.id || 0),
          targetDoctorId: Number(plan.candidate?.id || 0),
          sourceDoctorName: plan.source.name,
          targetDoctorName: plan.candidate?.name || 'Floating pool',
          shiftUnits: Number(plan.shiftUnits || 1),
          moved: 0,
          reason: explainRebalanceReason({
            sourceDoctorId: plan.source.id,
            targetDoctorId: plan.candidate?.id,
          }, rowsByDoctorId),
        }));

      setRebalanceExplainRows(explainRows);
      appendRebalanceAuditRows(explainRows, 'local');

      topPlans.forEach((plan) => {
        const sourceId = plan.source.id || doctorList.find((item) => item.name === plan.source.name)?.id;
        if (!sourceId) return;

        updateDoctor(sourceId, (prev) => ({
          ...prev,
          schedule: appendScheduleNote(prev.schedule, 'Tele-triage support active'),
        }));

        if (plan.candidate) {
          const candidateId = plan.candidate.id || doctorList.find((item) => item.name === plan.candidate.name)?.id;
          if (!candidateId) return;

          updateDoctor(candidateId, (prev) => ({
            ...prev,
            schedule: appendScheduleNote(prev.schedule, 'Overflow support shift'),
          }));
        }
      });

      setToast({ message: `Auto-balance deployed locally for ${topPlans.length} critical lane(s).`, type: 'success' });
    };

    run();
  }, [appendRebalanceAuditRows, doctorList, fetchDoctorsIntelligence, rebalanceRecommendations, rowsByDoctorId, updateDoctor]);

  // Lấy danh sách chuyên khoa
  // Lấy danh sách chuyên khoa (multi)
  const specialtyList = useMemo(() => {
    const set = new Set();
    doctorList.forEach(d => Array.isArray(d.specialty) ? d.specialty.forEach(s => set.add(s)) : d.specialty && set.add(d.specialty));
    return Array.from(set);
  }, [doctorList]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    let total = doctorList.length, active = 0, onleave = 0, inactive = 0;
    doctorList.forEach(d => {
      if (d.status === 'active') active++;
      if (d.status === 'onleave') onleave++;
      if (d.status === 'inactive') inactive++;
    });
    return { total, active, onleave, inactive };
  }, [doctorList]);

  const runDoctorsCommand = useCallback((action) => {
    if (!action) return;

    if (action === 'add') {
      setEditDoctor(null);
      setShowForm(true);
      return;
    }

    if (action === 'filter-active') {
      setStatusFilter('active');
      setShowInactive(false);
      return;
    }

    if (action === 'clear-filters') {
      setSearch('');
      setSpecialtyFilter('');
      setStatusFilter('');
      setPatientCountFilter('');
      setAppointmentCountFilter('');
      setKpiFilter('');
      setShowInactive(false);
      return;
    }

    if (action === 'focus-search') {
      searchInputRef.current?.focus();
      return;
    }

    if (action === 'jump-table') {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-charts') {
      chartsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-capacity') {
      capacityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-rebalance') {
      rebalanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'auto-balance') {
      handleAutoBalanceShiftPlan();
    }
  }, [handleAutoBalanceShiftPlan]);

  useEffect(() => {
    const urlAction = new URLSearchParams(window.location.search).get('cp_action');
    if (urlAction) {
      runDoctorsCommand(urlAction);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const onCommand = (event) => {
      const action = event?.detail?.action;
      runDoctorsCommand(action);
    };

    window.addEventListener('doctors:command', onCommand);
    return () => window.removeEventListener('doctors:command', onCommand);
  }, [runDoctorsCommand]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="doctors-content">
          {loading && <Spinner />}
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
          <div className="doctors-panel">
            {/* Mini KPI Bar Chart */}
            <MiniKPIBarChart doctors={doctorList} />
            <h2 className="doctors-title">Doctors</h2>
            {/* Quick stats */}
            <div className="doctors-stats-row">
              <div className="doctors-stat-card doctors-stat-total">Total: {stats.total}</div>
              <div className="doctors-stat-card doctors-stat-active">Active: {stats.active}</div>
              <div className="doctors-stat-card doctors-stat-leave">On Leave: {stats.onleave}</div>
              <div className="doctors-stat-card doctors-stat-inactive">Inactive: {stats.inactive}</div>
            </div>
            <div className="doctors-filter-row">
              <input ref={searchInputRef} type="text" placeholder="Search doctor name..." value={search} onChange={e => setSearch(e.target.value)} className="doctors-filter-input" />
              <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)} className="doctors-filter-select doctors-filter-select-specialty">
                <option value="">All Specialties</option>
                {specialtyList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="doctors-filter-select">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="onleave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
              <input type="number" min="0" placeholder="Patients ≥..." value={patientCountFilter} onChange={e => setPatientCountFilter(e.target.value)} className="doctors-filter-number" />
              <input type="number" min="0" placeholder="Appointments ≥..." value={appointmentCountFilter} onChange={e => setAppointmentCountFilter(e.target.value)} className="doctors-filter-number" />
              <input type="number" min="0" placeholder="KPI ≥..." value={kpiFilter} onChange={e => setKpiFilter(e.target.value)} className="doctors-filter-number" />
              <label className="doctors-inactive-toggle">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive
              </label>
              <button className="doctors-add-btn" onClick={handleAdd}>Add Doctor</button>
            </div>

            <section className="doctors-capacity-section">
              <h3>Realtime Operations Center</h3>
              <div className="doctors-realtime-actions">
                <button className="doctors-add-btn" type="button" onClick={() => fetchDoctorsIntelligence()}>
                  Refresh Intelligence Now
                </button>
                <label className="doctors-refresh-toggle">
                  <input
                    type="checkbox"
                    checked={autoRefreshIntelligence}
                    onChange={(event) => setAutoRefreshIntelligence(event.target.checked)}
                  />
                  Auto-refresh 45s
                </label>
                <span className="doctors-refresh-hint">
                  Last sync: {intelligenceLastSyncAt ? formatTimeShort(intelligenceLastSyncAt) : 'Pending'}
                </span>
              </div>
              <div className="doctors-alert-feed">
                {alertsWithAck.length === 0 ? (
                  <article className="doctors-alert-card doctors-alert-info">
                    <b>All stable</b>
                    <small>No active overload signals detected in the latest snapshot.</small>
                  </article>
                ) : alertsWithAck.map((alert) => (
                  <article key={alert.id} className={`doctors-alert-card doctors-alert-${alert.severity}`}>
                    <div>
                      <b>{alert.title}</b>
                      <small>{alert.detail}</small>
                    </div>
                    <div className="doctors-alert-meta">
                      <time>{formatTimeShort(alert.at)}</time>
                      {alert.severity === 'critical' && (
                        <button
                          type="button"
                          className={`doctors-alert-ack ${alert.acknowledged ? 'is-ack' : ''}`}
                          onClick={() => acknowledgeCriticalAlert(alert.id)}
                          disabled={alert.acknowledged}
                        >
                          {alert.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="doctors-capacity-section" ref={capacityRef}>
              <h3>Capacity Intelligence Board</h3>
              <div className="doctors-capacity-grid">
                <article>
                  <span>High Burnout</span>
                  <b>{capacityCohorts.high.count}</b>
                  <small>Avg load: {capacityCohorts.high.avg}</small>
                </article>
                <article>
                  <span>Medium Burnout</span>
                  <b>{capacityCohorts.medium.count}</b>
                  <small>Avg load: {capacityCohorts.medium.avg}</small>
                </article>
                <article>
                  <span>Low Burnout</span>
                  <b>{capacityCohorts.low.count}</b>
                  <small>Avg load: {capacityCohorts.low.avg}</small>
                </article>
              </div>
              <div className="doctors-table-shell">
                <table className="doctors-table doctors-capacity-table">
                  <thead>
                    <tr>
                      <th>Doctor</th>
                      <th>Visits</th>
                      <th>Pending</th>
                      <th>Cancelled</th>
                      <th>Load</th>
                      <th>Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorCapacityRows.slice(0, 6).map((row) => (
                      <tr key={`capacity-${row.id}`}>
                        <td>{row.name}</td>
                        <td>{row.visits}</td>
                        <td>{row.pendingCount}</td>
                        <td>{row.cancelledCount}</td>
                        <td>{row.loadScore}</td>
                        <td>
                          <span className={`doctor-status-chip ${row.burnoutBand === 'high' ? 'doctor-status-inactive' : row.burnoutBand === 'medium' ? 'doctor-status-onleave' : 'doctor-status-active'}`}>
                            {row.burnoutBand}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="doctors-capacity-section" ref={rebalanceRef}>
              <h3>Shift Rebalance Queue</h3>
              <div className="doctors-capacity-actions">
                <button className="doctors-add-btn" onClick={handleAutoBalanceShiftPlan}>Auto-Balance Shift Plan</button>
              </div>
              <div className="doctors-table-shell">
                <table className="doctors-table doctors-capacity-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Overloaded</th>
                      <th>Capacity Target</th>
                      <th>Shift Units</th>
                      <th>ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rebalanceRecommendations.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No rebalance actions required right now.</td>
                      </tr>
                    ) : rebalanceRecommendations.map((plan) => (
                      <tr key={`rebalance-${plan.rank}-${plan.source.id}`}>
                        <td>{plan.rank}</td>
                        <td>{plan.source.name}</td>
                        <td>{plan.candidate?.name || 'Floating pool'}</td>
                        <td>{plan.shiftUnits}</td>
                        <td>{plan.eta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rebalanceExplainRows.length > 0 && (
                <div className="doctors-rebalance-explain">
                  <h4>Rebalance Explain</h4>
                  <div className="doctors-table-shell">
                    <table className="doctors-table doctors-capacity-table">
                      <thead>
                        <tr>
                          <th>From</th>
                          <th>To</th>
                          <th>Units</th>
                          <th>Moved</th>
                          <th>Why This Move</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rebalanceExplainRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.sourceDoctorName}</td>
                            <td>{row.targetDoctorName}</td>
                            <td>{row.shiftUnits}</td>
                            <td>{row.moved}</td>
                            <td>{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {rebalanceAuditRows.length > 0 && (
                <div className="doctors-rebalance-explain doctors-rebalance-audit">
                  <div className="doctors-audit-head">
                    <h4>Rebalance Audit Trail (Session)</h4>
                    <div className="doctors-audit-actions">
                      <button
                        type="button"
                        className="doctors-add-btn"
                        onClick={() => {
                          const exportRows = rebalanceAuditRows.map((row) => ({
                            runAt: row.runAt,
                            engine: row.engine,
                            fromDoctor: row.sourceDoctorName,
                            toDoctor: row.targetDoctorName,
                            shiftUnits: row.shiftUnits,
                            moved: row.moved,
                            reason: row.reason,
                          }));
                          exportToCSV(exportRows, `rebalance_audit_${new Date().toISOString().slice(0, 10)}.csv`);
                        }}
                      >
                        Export Audit CSV
                      </button>
                      <button
                        type="button"
                        className="doctors-add-btn"
                        onClick={() => {
                          setRebalanceAuditRows([]);
                          sessionStorage.removeItem(REBALANCE_AUDIT_STORAGE_KEY);
                        }}
                      >
                        Clear Audit
                      </button>
                    </div>
                  </div>
                  <div className="doctors-table-shell">
                    <table className="doctors-table doctors-capacity-table">
                      <thead>
                        <tr>
                          <th>Run At</th>
                          <th>Engine</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Units</th>
                          <th>Moved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rebalanceAuditRows.map((row) => (
                          <tr key={row.id}>
                            <td>{formatTimeShort(row.runAt)}</td>
                            <td>{row.engine}</td>
                            <td>{row.sourceDoctorName}</td>
                            <td>{row.targetDoctorName}</td>
                            <td>{row.shiftUnits}</td>
                            <td>{row.moved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <div className="doctors-table-shell" ref={tableRef}>
              <table className="doctors-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Specialty</th>
                    <th>Status</th>
                    <th>Patients</th>
                    <th>Appointments</th>
                    <th>KPI</th>
                    <th className="doctors-th-center">Rating</th>
                    <th className="doctors-th-center">Review</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const history = getHistory(d.name);
                    const patients = Array.from(new Set(history.map(h => h.patient)));
                    // Badge trạng thái
                    let statusBadge = null;
                    if (d.status === 'active') statusBadge = <span className="doctor-status-chip doctor-status-active">Active</span>;
                    else if (d.status === 'onleave') statusBadge = <span className="doctor-status-chip doctor-status-onleave">On Leave</span>;
                    else if (d.status === 'inactive') statusBadge = <span className="doctor-status-chip doctor-status-inactive">Inactive</span>;
                    return (
                      <tr key={d.id} className="doctors-row">
                        <td>{d.id}</td>
                        <td className="doctors-name-cell" onClick={() => setModalDoctor({ ...d, history })}>
                          <AvatarIcon name={d.name} size={32} />
                          <span>{d.name}</span>
                        </td>
                        <td>{Array.isArray(d.specialty) ? d.specialty.join(', ') : d.specialty}</td>
                        <td>{statusBadge}</td>
                        <td>{patients.length}</td>
                        <td>{history.length}</td>
                        <td>{d.kpi?.month ?? 0}</td>
                        <td className="doctors-cell-center doctors-rating">
                          {d.kpi?.rating ? `${d.kpi.rating} ⭐` : '-'}
                        </td>
                        <td className="doctors-cell-center">
                          <button title="View Reviews" className="doctors-btn-reviews" onClick={() => setModalDoctor({ ...d, history, showReviews: true })}>Reviews</button>
                        </td>
                        <td className="doctors-actions-cell">
                          <button title="View Details" className="doctors-btn doctors-btn-details" onClick={() => setModalDoctor({ ...d, history })}><DetailsIcon /></button>
                          <button title="Edit" className="doctors-btn doctors-btn-edit" onClick={() => handleEdit(d)}><EditIcon /></button>
                          <button title="Schedule" className="doctors-btn doctors-btn-schedule" onClick={() => handleSchedule(d)}>Schedule</button>
                          <button title="Delete" className="doctors-btn doctors-btn-delete" onClick={() => handleDelete(d)}><DeleteIcon /></button>
                          {showSchedule && (
                            <DoctorSchedule
                              open={showSchedule}
                              onClose={() => setShowSchedule(false)}
                              doctor={scheduleDoctor}
                              onSave={handleSaveSchedule}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {modalDoctor && (
              <DoctorModal doctor={modalDoctor} onClose={() => setModalDoctor(null)} />
            )}
            {showForm && (
              <DoctorForm
                open={showForm}
                onClose={() => setShowForm(false)}
                onSave={handleSave}
                doctor={editDoctor}
              />
            )}
            {/* Biểu đồ tổng quan bác sĩ */}
            <div className="doctors-charts-row" ref={chartsRef}>
              <div className="doctors-chart-card">
                <div className="doctors-chart-title">Doctor Overview (Radar Chart)</div>
                <DoctorRadarChart doctors={filtered.map(d => ({
                  name: d.name,
                  kpi: d.kpi,
                  patients: Array.from(new Set(appointments.filter(a => a.doctor === d.name).map(a => a.patient))),
                  appointments: appointments.filter(a => a.doctor === d.name).length
                }))} />
              </div>
              <div className="doctors-chart-card">
                <DoctorPieCharts doctors={filtered} />
              </div>
            </div>
          </div>
          <div className="doctors-info-row">
            <div className="doctors-info-card">
              <div className="doctors-info-title">Doctor Management</div>
              <ul className="doctors-info-list">
                <li>Centralized management of doctor profiles and schedules.</li>
                <li>View appointment and patient history for each doctor.</li>
                <li>Manage and assign work shifts (schedule) for each doctor.</li>
                <li>Filter by specialty, status, and KPI.</li>
                <li>Data privacy: Only authorized staff can view/edit doctor info.</li>
              </ul>
            </div>
            <div className="doctors-info-card">
              <div className="doctors-info-title">Quick Actions</div>
              <ul className="doctors-info-list">
                <li>Search for doctors by name or specialty.</li>
                <li>View doctor details, appointment history, and work schedule.</li>
                <li>See number of patients, appointments, and KPI.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// exportDoctorsCSV removed

function DoctorModal({ doctor, onClose }) {
  const [showCalendar, setShowCalendar] = useState(false);
  return (
    <div className="patient-modal-overlay">
      <div className="patient-modal">
        <div className="patient-modal-header">
          <h3>Doctor: {doctor.name}</h3>
          <button className="patient-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="patient-modal-body">
          <div><b>ID:</b> {doctor.id}</div>
          <div><b>Name:</b> {doctor.name}</div>
          <div><b>Specialty:</b> {Array.isArray(doctor.specialty) ? doctor.specialty.join(', ') : doctor.specialty || '-'}</div>
          <div><b>Status:</b> {doctor.status || 'active'}</div>
          <div><b>Contact:</b> {doctor.contact || '-'}</div>
          <div><b>KPI (month):</b> {doctor.kpi?.month ?? 0} | <b>Rating:</b> {doctor.kpi?.rating ?? '-'} ⭐</div>
          <div><b>Schedule:</b> {doctor.schedule || '-'} <button className="doctors-calendar-btn" onClick={()=>setShowCalendar(true)}>View Calendar</button></div>
          <div><b>Status History:</b> {doctor.statusHistory?.join(' → ')}</div>
          <div><b>Reviews:</b> {doctor.reviews?.map((r,i)=>(<div key={i} className="doctors-review-item">“{r}”</div>))}</div>
          <div className="doctors-history-title"><b>Appointment History:</b></div>
          <table className="patient-modal-table">
            <thead><tr><th>Date</th><th>Patient</th><th>Status</th></tr></thead>
            <tbody>
              {doctor.history.map((h, i) => (
                <tr key={i}>
                  <td>{h.date}</td>
                  <td>{h.patient}</td>
                  <td>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="patient-modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
        {showCalendar && <CalendarModal doctor={doctor} onClose={()=>setShowCalendar(false)} />}
      </div>
    </div>
  );
}

export default Doctors;
