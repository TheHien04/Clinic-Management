
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaArrowRight, FaBed, FaBolt, FaCalendarAlt, FaChartBar, FaClipboardCheck,
  FaClipboardList, FaExclamationTriangle, FaHeartbeat, FaRobot, FaUser,
  FaUserMd,
} from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Dashboard.css';
import './Common.css';
import { ROUTES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { getAppointmentsAPI } from '../services/appointments';
import { getPatientsAPI } from '../services/patients';
import { getDoctorsAPI, getDoctorsIntelligenceAPI } from '../services/doctors';
import { initSocket, subscribeOpsAlerts, subscribeOperationsHandoverSaved } from '../services/socket';
import {
  downloadInnovationHandoverAuditsCsv,
  downloadInnovationHandoverCsv,
  getInnovationBedCensus,
  getInnovationHandoverAudits,
  getInnovationHandoverHistory,
  saveInnovationHandover,
} from '../services/innovation';
import {
  DASHBOARD_AUTOPILOT_KEY,
  DASHBOARD_HANDOVER_KEY,
  OPS_ALERTS_EVENT,
  allowMockFallback,
  fallbackAppointments,
  fallbackDoctors,
  fallbackPatients,
  normalizeAppointment,
  normalizePerson,
  pieColors,
  statusLabel,
  statusWeight,
} from '../features/dashboard/dashboardData';
import HospitalOperatingModel from '../features/dashboard/components/HospitalOperatingModel';

// PieChart tỷ lệ trạng thái appointments
function StatusPieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const dominant = [...data].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="chart-widget chart-widget-donut">
      <div className="chart-widget-head">
        <div><span>Flow composition</span><div className="chart-widget-title">Appointment mix</div></div>
        <span className="chart-live-badge"><i /> Live</span>
      </div>
      <div className="chart-insight-line"><strong>{dominant?.name || 'No data'}</strong><span>is the largest segment · {total} total</span></div>
      <ResponsiveContainer width="100%" height={228}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={63}
            outerRadius={92}
            paddingAngle={4}
            cornerRadius={7}
            stroke="none"
          >
            {data.map((entry, idx) => <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />)}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="donut-total">{total}</text>
          <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="donut-caption">APPOINTMENTS</text>
          <Tooltip formatter={(value) => [`${value} appointments`, 'Volume']} contentStyle={{ borderRadius: 4, border: '1px solid #cad4c8', boxShadow: '0 12px 28px rgba(8,47,43,.12)' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="chart-legend-grid">
        {data.map((d,idx) => (
          <span key={d.name} className="legend-item-card">
            <span className="legend-swatch" style={{ background: pieColors[idx % pieColors.length] }} />
            <span>{d.name}</span><b>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// Top bác sĩ nhiều lịch hẹn nhất tuần
function TopDoctors({ appointments }) {
  const doctorCount = {};
  appointments.forEach(a => {
    doctorCount[a.doctor] = (doctorCount[a.doctor] || 0) + 1;
  });
  const top = Object.entries(doctorCount).sort((a,b) => b[1]-a[1]).slice(0,3);
  const maxCount = top[0]?.[1] || 1;
  return (
    <div className="chart-widget chart-widget-leaderboard">
      <div className="chart-widget-head"><div><span>Clinical capacity</span><div className="chart-widget-title">Top care teams</div></div><span className="chart-period-badge">This week</span></div>
      <p className="chart-widget-note">Appointment volume by assigned clinician.</p>
      <ul className="unstyled-list doctor-leaderboard">
        {top.map(([name,count],idx) => (
          <li key={name} className="top-doctor-item">
            <span className="doctor-rank">0{idx + 1}</span><span className="doctor-avatar">{name.replace('Dr. ', '').slice(0, 2).toUpperCase()}</span>
            <div><strong>{name}</strong><span className="doctor-load-track"><i style={{ width: `${(count / maxCount) * 100}%` }} /></span></div><b>{count}</b>
          </li>
        ))}
        {top.length === 0 && <li className="chart-list-empty">No clinician activity in this period.</li>}
      </ul>
    </div>
  );
}

// Widget Recent Activities
function RecentActivities({ activities }) {
  return (
    <div className="chart-widget chart-widget-activity">
      <div className="chart-widget-head"><div><span>Audit pulse</span><div className="chart-widget-title">Recent activity</div></div><span className="chart-live-badge"><i /> Live</span></div>
      <p className="chart-widget-note">Latest transitions across the care network.</p>
      <ul className="unstyled-list activity-timeline">
        {activities.length === 0 ? <li className="subtle">No recent activities.</li> : activities.map((act,idx) => (
          <li key={idx} className="activity-item"><span>{String(idx + 1).padStart(2, '0')}</span><i /><p>{act}</p></li>
        ))}
      </ul>
    </div>
  );
}

function KPIBarChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const peak = [...data].sort((a, b) => b.count - a.count)[0];
  return (
    <div className="chart-widget chart-widget-trend">
      <div className="chart-widget-head">
        <div><span>7-day throughput</span><div className="chart-widget-title">Operational load</div></div>
        <span className="chart-period-badge">Last 7 days</span>
      </div>
      <div className="chart-metric-row">
        <div><strong>{total}</strong><span>Total appointments</span></div>
        <p>Peak <b>{peak?.date?.slice(5) || '—'}</b> · {peak?.count || 0} visits</p>
      </div>
      {total === 0 ? (
        <div className="chart-empty-state"><div className="chart-empty-orbit"><i /></div><strong>Awaiting care-flow data</strong><span>New appointments will appear here as a live trend.</span></div>
      ) : <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#20bfd3" stopOpacity={0.58} />
              <stop offset="100%" stopColor="#20bfd3" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#d8e5ea" strokeDasharray="2 6" />
          <XAxis dataKey="date" tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} tick={{ fill: '#6f8796', fontSize: 11 }} dy={8} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6f8796', fontSize: 11 }} />
          <Tooltip formatter={(value) => [`${value} appointments`, 'Volume']} labelFormatter={(label) => `Date ${label}`} contentStyle={{ borderRadius: 4, border: '1px solid #c7dce5', boxShadow: '0 12px 28px rgba(5,47,74,.12)' }} />
          <Area type="monotone" dataKey="count" name="Appointments" stroke="#087f9b" strokeWidth={3} fill="url(#loadGradient)" activeDot={{ r: 6, fill: '#20bfd3', stroke: '#075b83', strokeWidth: 3 }} />
        </AreaChart>
      </ResponsiveContainer>}
    </div>
  );
}

function AiInsightPanel({ insights }) {
  return (
    <section className="insight-panel" aria-label="AI health operations insights">
      <div className="insight-title"><FaRobot /> AI Health Ops Insights</div>
      <p className="insight-subtitle">Explainable suggestions generated from appointment patterns (rule-based analytics, no black-box prediction).</p>
      <div className="insight-grid">
        {insights.map((item) => (
          <article key={item.title} className={`insight-card insight-${item.level}`}>
            <h4>{item.title}</h4>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const insightRef = useRef(null);
  const warningsRef = useRef(null);
  const capacityRef = useRef(null);
  const handoverRef = useRef(null);
  const missionRef = useRef(null);
  const feedRef = useRef(null);
  const [feedRunning, setFeedRunning] = useState(true);
  const [feedCursor, setFeedCursor] = useState(4);
  const [sourceLabel, setSourceLabel] = useState(
    allowMockFallback
      ? 'Data source: Mock fallback (loading API...)'
      : 'Data source: Waiting for backend operations snapshot'
  );
  const [socketLinkState, setSocketLinkState] = useState('offline');
  const [escalationPulse, setEscalationPulse] = useState(0);
  const [lastRealtimeAt, setLastRealtimeAt] = useState('N/A');
  const [bedBoardFromIntelligence, setBedBoardFromIntelligence] = useState([]);
  const [autopilotMode, setAutopilotMode] = useState(
    () => localStorage.getItem(DASHBOARD_AUTOPILOT_KEY) || 'balanced'
  );
  const [opsStreamEvents, setOpsStreamEvents] = useState([]);
  const [appointments, setAppointments] = useState(allowMockFallback ? fallbackAppointments : []);
  const [patients, setPatients] = useState(allowMockFallback ? fallbackPatients : []);
  const [doctors, setDoctors] = useState(allowMockFallback ? fallbackDoctors : []);
  const [coreDataState, setCoreDataState] = useState('loading');
  const [handoverDraft, setHandoverDraft] = useState({
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
  });
  const [handoverSavedAt, setHandoverSavedAt] = useState('');
  const [handoverSaveStatus, setHandoverSaveStatus] = useState('');
  const [handoverHistory, setHandoverHistory] = useState([]);
  const [handoverAuditLogs, setHandoverAuditLogs] = useState([]);
  const [handoverPagination, setHandoverPagination] = useState({
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
  });
  const [handoverFilters, setHandoverFilters] = useState({
    authoredBy: '',
    fromDate: '',
    toDate: '',
  });

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        const [appointmentsRows, patientsRows, doctorsRows, intelligencePayload, bedCensusPayload, handoverHistoryPayload, handoverAuditPayload] = await Promise.all([
          getAppointmentsAPI({ limit: 2000, offset: 0 }).catch(() => null),
          getPatientsAPI({ limit: 300, offset: 0 }).catch(() => null),
          getDoctorsAPI({ limit: 300, offset: 0 }).catch(() => null),
          getDoctorsIntelligenceAPI().catch(() => null),
          getInnovationBedCensus().catch(() => null),
          getInnovationHandoverHistory(6, { page: 1 }).catch(() => null),
          getInnovationHandoverAudits(12).catch(() => null),
        ]);

        if (!active) return;

        const mappedAppointments = Array.isArray(appointmentsRows)
          ? appointmentsRows.map(normalizeAppointment).filter(Boolean)
          : [];
        const mappedPatients = Array.isArray(patientsRows)
          ? patientsRows.map((item) => normalizePerson(item, 'Patient')).filter(Boolean)
          : [];
        const mappedDoctors = Array.isArray(doctorsRows)
          ? doctorsRows.map((item) => normalizePerson(item, 'Doctor')).filter(Boolean)
          : [];
        const capacityRows = Array.isArray(intelligencePayload?.capacityRows)
          ? intelligencePayload.capacityRows
          : [];

        if (capacityRows.length) {
          const intelligenceBeds = [
            {
              id: 'ward-ed',
              ward: 'Emergency Ward',
              occupied: Math.min(26, Math.round(9 + capacityRows.reduce((sum, row) => sum + Number(row.pendingCount || 0), 0) * 1.4)),
              total: 26,
            },
            {
              id: 'ward-icu',
              ward: 'ICU',
              occupied: Math.min(12, Math.round(5 + capacityRows.filter((row) => row.burnoutBand === 'high').length * 1.8)),
              total: 12,
            },
            {
              id: 'ward-inpatient',
              ward: 'Inpatient Ward',
              occupied: Math.min(42, Math.round(18 + capacityRows.reduce((sum, row) => sum + Number(row.uniquePatients || 0), 0) * 0.4)),
              total: 42,
            },
            {
              id: 'ward-surgery',
              ward: 'Post-Op Recovery',
              occupied: Math.min(16, Math.round(6 + capacityRows.reduce((sum, row) => sum + Number(row.cancelledCount || 0), 0) * 1.2)),
              total: 16,
            },
          ].map((row) => {
            const usage = Math.round((row.occupied / row.total) * 100);
            return {
              ...row,
              usage,
              level: usage >= 88 ? 'high' : usage >= 75 ? 'medium' : 'normal',
            };
          });
          setBedBoardFromIntelligence(intelligenceBeds);
        }

        const bedRowsFromApi = Array.isArray(bedCensusPayload?.wards) ? bedCensusPayload.wards : [];
        if (bedRowsFromApi.length) {
          setBedBoardFromIntelligence(
            bedRowsFromApi.map((row) => ({
              id: row.id,
              ward: row.ward,
              occupied: Number(row.occupied || 0),
              total: Number(row.total || 1),
              usage: Number(row.usage || 0),
              level: row.level || 'normal',
            }))
          );
        }

        const historyRows = Array.isArray(handoverHistoryPayload?.history)
          ? handoverHistoryPayload.history
          : [];
        if (historyRows.length) {
          setHandoverHistory(historyRows.slice(0, 6));
        }
        if (handoverHistoryPayload?.pagination) {
          setHandoverPagination((prev) => ({
            ...prev,
            ...handoverHistoryPayload.pagination,
          }));
        }

        if (Array.isArray(handoverAuditPayload?.audits)) {
          setHandoverAuditLogs(handoverAuditPayload.audits);
        }

        const latestHandover = historyRows[0] || null;
        if (latestHandover) {
          setHandoverDraft({
            situation: String(latestHandover.situation || ''),
            background: String(latestHandover.background || ''),
            assessment: String(latestHandover.assessment || ''),
            recommendation: String(latestHandover.recommendation || ''),
          });
          setHandoverSavedAt(String(latestHandover.savedAt || ''));
        }

        const hasCoreData = mappedAppointments.length > 0 && mappedPatients.length > 0 && mappedDoctors.length > 0;
        const hasPartialData = mappedAppointments.length > 0 || mappedPatients.length > 0 || mappedDoctors.length > 0;

        setAppointments(mappedAppointments);
        setPatients(mappedPatients);
        setDoctors(mappedDoctors);

        if (hasCoreData) {
          setSourceLabel('Data source: Backend API (live operations snapshot)');
          setCoreDataState('live');
          return;
        }

        if (hasPartialData) {
          setSourceLabel('Data source: Backend API (partial snapshot · retrying unavailable services)');
          setCoreDataState(mappedAppointments.length ? 'live' : 'unavailable');
          return;
        }

        if (allowMockFallback) {
          setSourceLabel('Data source: Mock fallback (backend auth/data seed needed)');
        } else {
          setAppointments([]);
          setPatients([]);
          setDoctors([]);
          setSourceLabel('Data source: Degraded (backend data unavailable)');
          setCoreDataState('unavailable');
        }
      } catch {
        if (!active) return;
        if (allowMockFallback) {
          setSourceLabel('Data source: Mock fallback (API unavailable)');
        } else {
          setAppointments([]);
          setPatients([]);
          setDoctors([]);
          setSourceLabel('Data source: Degraded (API unavailable)');
          setCoreDataState('unavailable');
        }
      }
    };

    fetchDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const reloadHandoverHistory = useCallback(async (filters, page) => {
    try {
      const response = await getInnovationHandoverHistory(handoverPagination.limit, {
        page,
        authoredBy: filters.authoredBy || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
      });
      const rows = Array.isArray(response?.history) ? response.history : [];
      setHandoverHistory(rows);
      if (response?.pagination) {
        setHandoverPagination((prev) => ({
          ...prev,
          ...response.pagination,
        }));
      }
    } catch {
      // Keep existing snapshot when API is temporarily unavailable.
    }
  }, [handoverPagination.limit]);

  const reloadHandoverAudits = useCallback(async () => {
    try {
      const response = await getInnovationHandoverAudits(12);
      const rows = Array.isArray(response?.audits) ? response.audits : [];
      setHandoverAuditLogs(rows);
    } catch {
      // Keep existing snapshot when API is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    reloadHandoverHistory(handoverFilters, handoverPagination.page);
  }, [handoverFilters, handoverPagination.page, reloadHandoverHistory]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_HANDOVER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      setHandoverDraft((prev) => ({
        ...prev,
        ...parsed,
      }));
      if (parsed.savedAt) {
        setHandoverSavedAt(parsed.savedAt);
      }
    } catch {
      // Ignore invalid local snapshot.
    }
  }, []);

  const today = useMemo(() => {
    const latestAppointmentDate = appointments
      .map((appointment) => appointment.date)
      .filter(Boolean)
      .sort()
      .at(-1);

    return latestAppointmentDate || new Date().toISOString().slice(0, 10);
  }, [appointments]);

  const kpi = useMemo(() => {
    const todayApps = appointments.filter(a => a.date === today);
    const waiting = todayApps.filter(a => a.status === 'pending').length;
    const completed = todayApps.filter(a => a.status === 'completed').length;
    const cancellation = todayApps.filter(a => a.status === 'cancelled').length;

    const byDoctorTime = {};
    let conflictCount = 0;
    todayApps.forEach((a) => {
      const key = `${a.doctor}-${a.date}-${a.time}`;
      byDoctorTime[key] = (byDoctorTime[key] || 0) + 1;
      if (byDoctorTime[key] === 2) {
        conflictCount += 1;
      }
    });

    const completionRate = todayApps.length ? Math.round((completed / todayApps.length) * 100) : 0;
    const cancellationRate = todayApps.length ? Math.round((cancellation / todayApps.length) * 100) : 0;

    return {
      today: todayApps.length,
      waiting,
      completed,
      cancellation,
      completionRate,
      cancellationRate,
      conflictCount,
    };
  }, [appointments, today]);

  const statusPieData = useMemo(() => {
    const statusCount = {};
    appointments.forEach(a => {
      statusCount[a.status] = (statusCount[a.status] || 0) + 1;
    });
    return Object.entries(statusCount)
      .sort((a, b) => (statusWeight[a[0]] ?? 99) - (statusWeight[b[0]] ?? 99))
      .map(([name, value]) => ({ name: statusLabel[name] || name, value }));
  }, [appointments]);

  const recentActivities = useMemo(() => {
    return [...appointments]
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 5)
      .map((a) => `${statusLabel[a.status] || a.status} appointment: ${a.patient} with ${a.doctor} at ${a.time} (${a.date}).`);
  }, [appointments]);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date(today).getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    return { date: dateStr };
  });

  const barChartData = useMemo(() => {
    const dayCountMap = appointments.reduce((acc, item) => {
      acc[item.date] = (acc[item.date] || 0) + 1;
      return acc;
    }, {});
    return last7Days.map((d) => ({ date: d.date, count: dayCountMap[d.date] || 0 }));
  }, [appointments, last7Days]);

  const insights = useMemo(() => {
    const repeatPatients = appointments.length - new Set(appointments.map((a) => a.patient)).size;
    const items = [
      {
        title: 'Schedule Quality',
        detail: kpi.conflictCount > 0
          ? `Detected ${kpi.conflictCount} duplicate doctor time-slot(s). Add hard validation before booking to avoid collisions.`
          : 'No duplicate doctor time-slots detected for latest operating day.',
        level: kpi.conflictCount > 0 ? 'warn' : 'good',
      },
      {
        title: 'Operational Throughput',
        detail: `Completion rate is ${kpi.completionRate}%. Target in outpatient clinics is typically >= 85%.`,
        level: kpi.completionRate >= 85 ? 'good' : 'warn',
      },
      {
        title: 'Continuity of Care',
        detail: `Repeat-patient signal: ${repeatPatients} follow-up visit(s) found. Consider proactive reminders for chronic care cohorts.`,
        level: 'info',
      },
    ];
    return items;
  }, [appointments, kpi.conflictCount, kpi.completionRate]);

  const earlyWarnings = useMemo(() => {
    const pendingPressure = kpi.waiting >= 3;
    const completionRisk = kpi.completionRate < 75;
    const cancellationRisk = kpi.cancellationRate >= 20;

    return [
      {
        title: 'Queue Pressure',
        value: `${kpi.waiting} waiting`,
        level: pendingPressure ? 'high' : 'low',
        hint: pendingPressure ? 'Open overflow slots for this shift.' : 'Queue flow is currently healthy.',
      },
      {
        title: 'Throughput Alert',
        value: `${kpi.completionRate}% completed`,
        level: completionRisk ? 'medium' : 'low',
        hint: completionRisk ? 'Prioritize pending confirmations and check-ins.' : 'Completion trend is on target.',
      },
      {
        title: 'Cancellation Pulse',
        value: `${kpi.cancellationRate}% cancelled`,
        level: cancellationRisk ? 'high' : 'low',
        hint: cancellationRisk ? 'Trigger reminder workflow for tomorrow schedule.' : 'Cancellation rate remains stable.',
      },
    ];
  }, [kpi.waiting, kpi.completionRate, kpi.cancellationRate]);

  const mapOpsAlertsToFeedEvents = useCallback((alerts = []) => {
    return alerts.slice(0, 8).map((alert, index) => {
      const severity = String(alert?.severity || 'info').toLowerCase();
      const normalizedSeverity =
        severity === 'critical' ? 'high' : severity === 'warning' ? 'medium' : 'low';
      const ts = Number.isNaN(new Date(alert?.at).getTime())
        ? Date.now() - index * 1000
        : new Date(alert.at).getTime();

      return {
        id: `ops-${alert.id || `${Date.now()}-${index}`}`,
        severity: normalizedSeverity,
        title: `Alert: ${alert.title || 'Ops signal'}`,
        channel: 'Ops Alerts Stream',
        at: alert.at || new Date(ts).toISOString(),
        detail: alert.detail || 'No detail provided.',
        ts,
      };
    });
  }, []);

  const mergeOpsEvents = useCallback((mapped) => {
    setOpsStreamEvents((prev) => {
      const seen = new Set((prev || []).map((item) => item.id));
      const merged = [...mapped.filter((item) => !seen.has(item.id)), ...(prev || [])];
      return merged.slice(0, 20);
    });
    if (mapped[0]?.at) {
      setLastRealtimeAt(mapped[0].at);
    }
  }, []);

  const shiftCommand = useMemo(() => {
    const edBedsTotal = 24;
    const icuBedsTotal = 12;
    const triageOpenLanes = Math.max(2, 4 - (autopilotMode === 'recovery' ? 0 : 1));
    const waitingRatio = Math.min(1, kpi.waiting / 6);
    const completedRatio = Math.min(1, kpi.completionRate / 100);

    const edOccupied = Math.min(edBedsTotal, Math.round(edBedsTotal * (0.58 + waitingRatio * 0.32)));
    const icuOccupied = Math.min(icuBedsTotal, Math.round(icuBedsTotal * (0.5 + (1 - completedRatio) * 0.36)));
    const nurseCoverage = Math.max(78, 98 - kpi.waiting * 3 - (autopilotMode === 'growth' ? 4 : 0));
    const medianDoorToDoctor = Math.max(8, 19 + kpi.waiting * 3 - (autopilotMode === 'recovery' ? 4 : 0));

    return [
      {
        id: 'ed-beds',
        label: 'ED Beds Occupied',
        value: `${edOccupied}/${edBedsTotal}`,
        note: edOccupied >= 20 ? 'Activate overflow protocol' : 'Within safe occupancy band',
        level: edOccupied >= 20 ? 'high' : 'normal',
      },
      {
        id: 'icu-beds',
        label: 'ICU Capacity',
        value: `${icuOccupied}/${icuBedsTotal}`,
        note: icuOccupied >= 10 ? 'Escalation huddle advised' : 'Capacity buffer available',
        level: icuOccupied >= 10 ? 'high' : 'normal',
      },
      {
        id: 'triage-lanes',
        label: 'Triage Lanes Online',
        value: `${triageOpenLanes}/4`,
        note: triageOpenLanes <= 2 ? 'Open fast-track station' : 'Flow balanced at triage desk',
        level: triageOpenLanes <= 2 ? 'medium' : 'normal',
      },
      {
        id: 'door-doctor',
        label: 'Median Door-to-Doctor',
        value: `${medianDoorToDoctor} min`,
        note: medianDoorToDoctor > 28 ? 'Risk of left-without-seen' : 'Target under 30 minutes',
        level: medianDoorToDoctor > 28 ? 'medium' : 'normal',
      },
      {
        id: 'nurse-cover',
        label: 'Nurse Coverage',
        value: `${nurseCoverage}%`,
        note: nurseCoverage < 86 ? 'Request on-call reinforcement' : 'Shift roster stable',
        level: nurseCoverage < 86 ? 'medium' : 'normal',
      },
    ];
  }, [kpi.waiting, kpi.completionRate, autopilotMode]);

  const patientJourneyBoard = useMemo(() => {
    const checkIn = Math.max(0, kpi.today + 4);
    const triage = Math.max(0, kpi.waiting + 2);
    const physicianReview = Math.max(0, kpi.today - kpi.completed + 1);
    const diagnostics = Math.max(0, Math.round(kpi.today * 0.42));
    const discharge = Math.max(0, kpi.completed);

    return [
      {
        id: 'journey-checkin',
        stage: 'Check-in Desk',
        count: checkIn,
        target: '< 12 min',
        note: 'Identity and insurance verification in progress.',
      },
      {
        id: 'journey-triage',
        stage: 'Nurse Triage',
        count: triage,
        target: '< 15 min',
        note: 'Vitals and acuity scores being finalized.',
      },
      {
        id: 'journey-review',
        stage: 'Physician Review',
        count: physicianReview,
        target: '< 25 min',
        note: 'Consultation rooms actively cycling patients.',
      },
      {
        id: 'journey-diagnostics',
        stage: 'Labs / Imaging',
        count: diagnostics,
        target: '< 35 min',
        note: 'Diagnostics queue synchronized with consult teams.',
      },
      {
        id: 'journey-discharge',
        stage: 'Discharge & Follow-up',
        count: discharge,
        target: '< 10 min',
        note: 'Medication counseling and follow-up booking.',
      },
    ];
  }, [kpi.today, kpi.waiting, kpi.completed]);

  const criticalCareBoard = useMemo(() => {
    const criticalEventCount = opsStreamEvents.filter((item) => item.severity === 'high').length;
    const erEscalations = Math.max(
      1,
      Math.round(kpi.waiting / 2) + (autopilotMode === 'recovery' ? 1 : 0) + Math.min(3, criticalEventCount)
    );
    const transferPending = Math.max(0, Math.round((100 - kpi.completionRate) / 18));
    const highAcuityWatch = Math.max(2, Math.round(kpi.today * 0.3) + Math.min(2, escalationPulse));

    return [
      {
        id: 'cc-er',
        unit: 'Emergency Department',
        status: erEscalations >= 3 ? 'Escalated Monitoring' : 'Controlled Load',
        metric: `${erEscalations} escalation case(s)`,
        level: erEscalations >= 3 ? 'high' : 'normal',
      },
      {
        id: 'cc-icu',
        unit: 'Intensive Care Unit',
        status: transferPending >= 2 ? 'Transfer Queue Active' : 'Transfer Queue Stable',
        metric: `${transferPending} transfer pending`,
        level: transferPending >= 2 ? 'medium' : 'normal',
      },
      {
        id: 'cc-watch',
        unit: 'High-Acuity Observation',
        status: highAcuityWatch >= 4 ? 'Tight Clinical Watch' : 'Routine Clinical Watch',
        metric: `${highAcuityWatch} patient(s) under watch`,
        level: highAcuityWatch >= 4 ? 'medium' : 'normal',
      },
    ];
  }, [kpi.waiting, kpi.completionRate, kpi.today, autopilotMode, opsStreamEvents, escalationPulse]);

  const bedManagementBoard = useMemo(() => {
    if (bedBoardFromIntelligence.length) {
      return bedBoardFromIntelligence;
    }

    const nurseFactor = Math.max(0.8, doctors.length / 5);
    const edOccupied = Math.min(26, Math.round(13 + kpi.waiting * 2));
    const icuOccupied = Math.min(12, Math.round(6 + (100 - kpi.completionRate) / 12));
    const wardOccupied = Math.min(42, Math.round(24 + kpi.today * 1.4));
    const surgeryOccupied = Math.min(16, Math.round(7 + nurseFactor * 3));

    return [
      {
        id: 'ward-ed',
        ward: 'Emergency Ward',
        occupied: edOccupied,
        total: 26,
      },
      {
        id: 'ward-icu',
        ward: 'ICU',
        occupied: icuOccupied,
        total: 12,
      },
      {
        id: 'ward-inpatient',
        ward: 'Inpatient Ward',
        occupied: wardOccupied,
        total: 42,
      },
      {
        id: 'ward-surgery',
        ward: 'Post-Op Recovery',
        occupied: surgeryOccupied,
        total: 16,
      },
    ].map((row) => {
      const usage = Math.round((row.occupied / row.total) * 100);
      return {
        ...row,
        usage,
        level: usage >= 88 ? 'high' : usage >= 75 ? 'medium' : 'normal',
      };
    });
  }, [bedBoardFromIntelligence, kpi.waiting, kpi.completionRate, kpi.today, doctors.length]);

  const missionQueue = useMemo(() => {
    const throughputBoost = autopilotMode === 'growth' ? 10 : autopilotMode === 'recovery' ? 5 : 0;
    const queueBoost = autopilotMode === 'recovery' ? 10 : 0;
    const conflictBoost = autopilotMode === 'recovery' ? 8 : 0;

    const queue = [
      {
        id: 'triage-pending',
        title: 'Clear pending bottleneck',
        owner: 'Frontdesk Coordinator',
        eta: '30m',
        score: Math.min(100, 42 + kpi.waiting * 9 + queueBoost),
        detail: `There are ${kpi.waiting} pending appointments requiring confirmation/check-in action.`,
      },
      {
        id: 'throughput-boost',
        title: 'Protect same-day throughput',
        owner: 'Shift Lead',
        eta: '45m',
        score: Math.min(100, 25 + Math.max(0, 85 - kpi.completionRate) * 2 + throughputBoost),
        detail: `Completion rate is ${kpi.completionRate}%. Recommend targeted staff rebalance for active slots.`,
      },
      {
        id: 'conflict-prevention',
        title: 'Resolve schedule collisions',
        owner: 'Operations Analyst',
        eta: '20m',
        score: Math.min(100, 18 + kpi.conflictCount * 26 + conflictBoost),
        detail: kpi.conflictCount
          ? `${kpi.conflictCount} duplicate doctor slot(s) detected. Apply slot validation hard-stop.`
          : 'No collisions detected. Keep preventive validation enabled.',
      },
    ];

    return queue.sort((a, b) => b.score - a.score);
  }, [kpi.waiting, kpi.completionRate, kpi.conflictCount, autopilotMode]);

  const shiftHandover = useMemo(() => {
    const unresolved = missionQueue.slice(0, 2).map((item) => `${item.title} (${item.owner})`);
    const warningSignals = earlyWarnings
      .filter((item) => item.level === 'high' || item.level === 'medium')
      .map((item) => `${item.title}: ${item.value}`);

    return {
      situation: handoverDraft.situation || `ED queue at ${kpi.waiting} waiting, completion rate ${kpi.completionRate}%.`,
      background: handoverDraft.background || `${kpi.today} same-day appointments with ${doctors.length} active doctors on shift.`,
      assessment: handoverDraft.assessment || (warningSignals.length
        ? warningSignals.join(' | ')
        : 'No major bottleneck signal in current shift window.'),
      recommendation: handoverDraft.recommendation || (unresolved.length
        ? unresolved.join(' | ')
        : 'Maintain current staffing pattern and monitor queue every 30 minutes.'),
      unresolved,
    };
  }, [missionQueue, earlyWarnings, kpi.waiting, kpi.completionRate, kpi.today, doctors.length, handoverDraft]);

  const criticalEventsLast15m = useMemo(() => {
    const now = Date.now();
    return opsStreamEvents.filter((item) => item.severity === 'high' && item.ts && (now - item.ts <= 15 * 60 * 1000)).length;
  }, [opsStreamEvents]);

  const saveHandoverDraft = useCallback(async () => {
    const payload = {
      ...handoverDraft,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DASHBOARD_HANDOVER_KEY, JSON.stringify(payload));
    setHandoverSaveStatus('Saving brief...');

    try {
      const saved = await saveInnovationHandover({
        situation: payload.situation,
        background: payload.background,
        assessment: payload.assessment,
        recommendation: payload.recommendation,
      });
      setHandoverSavedAt(saved?.savedAt || payload.savedAt);
      setHandoverSaveStatus('Saved to backend');
      setHandoverHistory((prev) => [
        {
          handoverId: Number(saved?.handoverId || Date.now()),
          situation: payload.situation,
          authoredBy: String(saved?.authoredBy || 'unknown'),
          savedAt: String(saved?.savedAt || payload.savedAt),
        },
        ...prev,
      ].slice(0, handoverPagination.limit));
      return;
    } catch {
      setHandoverSavedAt(payload.savedAt);
      setHandoverSaveStatus(
        allowMockFallback
          ? 'Saved locally (backend unavailable)'
          : 'Save failed (backend persistence unavailable)'
      );
    }
  }, [handoverDraft, handoverPagination.limit]);

  const liveFeedEvents = useMemo(() => {
    const appointmentEvents = [...appointments]
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .map((item, index) => ({
        id: `${item.id}-${index}`,
        severity:
          item.status === 'cancelled'
            ? 'high'
            : item.status === 'pending'
              ? 'medium'
              : 'low',
        title: `${statusLabel[item.status] || item.status}: ${item.patient}`,
        channel: item.status === 'cancelled' ? 'Ops Alert Stream' : 'Appointment Stream',
        at: `${item.date} ${item.time}`,
        detail: `${item.patient} with ${item.doctor}`,
        ts: new Date(`${item.date}T${item.time}:00`).getTime(),
      }));

    const externalEvents = (opsStreamEvents || []).map((item) => ({
      ...item,
      ts: Number(item.ts || 0),
    }));

    return [...externalEvents, ...appointmentEvents]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 20);
  }, [appointments, opsStreamEvents]);

  useEffect(() => {
    const onOpsAlertsUpdate = (event) => {
      const alerts = Array.isArray(event?.detail?.alerts) ? event.detail.alerts : [];
      if (!alerts.length) return;

      const mapped = mapOpsAlertsToFeedEvents(alerts);
      mergeOpsEvents(mapped);
      setEscalationPulse((prev) => Math.min(3, prev + 1));
    };

    window.addEventListener(OPS_ALERTS_EVENT, onOpsAlertsUpdate);
    return () => window.removeEventListener(OPS_ALERTS_EVENT, onOpsAlertsUpdate);
  }, [mapOpsAlertsToFeedEvents, mergeOpsEvents]);

  useEffect(() => {
    const socket = initSocket();
    if (!socket) return undefined;

    setSocketLinkState('connected');
    const unsubscribe = subscribeOpsAlerts((payload) => {
      const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
      if (!alerts.length) return;

      const mapped = mapOpsAlertsToFeedEvents(alerts);
      mergeOpsEvents(mapped);
      setEscalationPulse((prev) => Math.min(3, prev + 1));
    });
    const unsubscribeHandover = subscribeOperationsHandoverSaved((payload) => {
      reloadHandoverHistory(handoverFilters, 1);
      if (payload?.savedAt) {
        setHandoverSavedAt(String(payload.savedAt));
      }
      setHandoverSaveStatus('Realtime sync received');
      reloadHandoverAudits();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof unsubscribeHandover === 'function') unsubscribeHandover();
      setSocketLinkState('offline');
    };
  }, [mapOpsAlertsToFeedEvents, mergeOpsEvents, reloadHandoverAudits, reloadHandoverHistory, handoverFilters]);

  useEffect(() => {
    if (!escalationPulse) return undefined;
    const timer = setTimeout(() => {
      setEscalationPulse((prev) => Math.max(0, prev - 1));
    }, 6000);
    return () => clearTimeout(timer);
  }, [escalationPulse]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_AUTOPILOT_KEY, autopilotMode);
  }, [autopilotMode]);

  useEffect(() => {
    if (!feedRunning) return undefined;
    const timer = setInterval(() => {
      setFeedCursor((prev) => {
        if (prev >= liveFeedEvents.length) return 3;
        return prev + 1;
      });
    }, 2800);

    return () => clearInterval(timer);
  }, [feedRunning, liveFeedEvents.length]);

  const feedWindow = useMemo(
    () => liveFeedEvents.slice(0, Math.max(3, feedCursor)),
    [liveFeedEvents, feedCursor]
  );

  const handleShortcut = useCallback((key) => {
    if (key === 'book') navigate(`/${ROUTES.APPOINTMENTS}`);
    if (key === 'schedule') navigate(`/${ROUTES.DOCTORS}`);
    if (key === 'kpi') navigate(`/${ROUTES.REPORTS}`);
  }, [navigate]);

  const runDashboardCommand = useCallback((action) => {
    if (!action) return;

    if (action === 'book' || action === 'schedule' || action === 'kpi') {
      handleShortcut(action);
      return;
    }

    if (action === 'jump-insights') {
      insightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-warnings') {
      warningsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-mission') {
      missionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-feed') {
      feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'toggle-feed') {
      setFeedRunning((prev) => !prev);
      return;
    }

    if (action === 'run-autopilot') {
      setAutopilotMode('recovery');
      warningsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'set-autopilot-balanced') {
      setAutopilotMode('balanced');
      missionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'set-autopilot-growth') {
      setAutopilotMode('growth');
      missionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'set-autopilot-recovery') {
      setAutopilotMode('recovery');
      missionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [handleShortcut]);

  useEffect(() => {
    const urlAction = new URLSearchParams(window.location.search).get('cp_action');
    if (urlAction) {
      runDashboardCommand(urlAction);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const onCommand = (event) => {
      const action = event?.detail?.action;
      runDashboardCommand(action);
    };

    window.addEventListener('dashboard:command', onCommand);
    return () => window.removeEventListener('dashboard:command', onCommand);
  }, [runDashboardCommand]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main id="main-content" tabIndex="-1" className="dashboard-content">
          <section className="ops-hero" aria-labelledby="ops-hero-title">
            <span className="mission-sr-only">Health Operations Command Center</span>
            <div className="ops-hero-copy">
              <p className="ops-kicker"><span /> Live care operations</p>
              <h1 id="ops-hero-title">Command every shift with <em>clarity.</em></h1>
              <p className="ops-hero-lede">One clinical operating picture for patient flow, team capacity and the decisions that cannot wait.</p>
              <div className="ops-hero-actions">
                <button type="button" onClick={() => navigate(`/${ROUTES.APPOINTMENTS}`)}>Run appointment flow <span>↗</span></button>
                <button type="button" onClick={() => navigate(`/${ROUTES.REPORTS}`)}>View intelligence</button>
              </div>
              <div className="ops-hero-meta"><span>{sourceLabel}</span><b>Updated live</b></div>
            </div>
            <div className="ops-hero-visual" aria-label="Hospital operations team coordinating patient care">
              <img src="/images/operations-center.jpg" alt="Hospital operations team coordinating patient care" />
              <div className="ops-image-wash" />
              <article className="ops-float-card ops-float-primary"><small>Care network</small><strong>All systems coordinated</strong><span><i /> Live signal</span></article>
              <article className="ops-float-card ops-float-secondary"><small>Completion</small><strong>{kpi.completionRate}%</strong><span>Today’s care loop</span></article>
            </div>
          </section>

          <HospitalOperatingModel kpi={kpi} navigate={navigate} />

          <div className="dashboard-section-intro">
            <div><span>01 / Live pulse</span><h2>What needs attention now</h2></div>
            <p><FaHeartbeat /> Real-time appointment flow, capacity and care continuity.</p>
          </div>
          
          <div className="dashboard-stats-row">
            <div className="stats-container">
              <div className="stat-card">
                <div className="stat-title"><FaCalendarAlt style={{color:'#0a7ea4'}}/>Today's Appointments</div>
                <div className="stat-value">{coreDataState === 'unavailable' ? '—' : kpi.today}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaUser style={{color:'#f29f05'}}/>Waiting</div>
                <div className="stat-value">{coreDataState === 'unavailable' ? '—' : kpi.waiting === 0 ? 'Clear' : kpi.waiting}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaChartBar style={{color:'#1f8a5c'}}/>Completed</div>
                <div className="stat-value">{coreDataState === 'unavailable' ? '—' : kpi.completed}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaUserMd style={{color:'#0a7ea4'}}/>Doctors</div>
                <div className="stat-value">{coreDataState === 'unavailable' ? '—' : doctors.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaUser style={{color:'#0a7ea4'}}/>Patients</div>
                <div className="stat-value">{coreDataState === 'unavailable' ? '—' : patients.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaHeartbeat style={{color:'#1f8a5c'}}/>Completion Rate</div>
                <div className="stat-value">{coreDataState === 'unavailable' || kpi.today === 0 ? '—' : `${kpi.completionRate}%`}</div>
              </div>
            </div>
          </div>

          <nav className="dashboard-control-rail" aria-label="Shift operations navigation">
            <div className="control-rail-title"><span>Decision rail</span><strong>Signal → action</strong></div>
            <button type="button" onClick={() => warningsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FaExclamationTriangle aria-hidden="true"/><span><b>Risk desk</b><small>{earlyWarnings.length} active signals</small></span><FaArrowRight aria-hidden="true"/></button>
            <button type="button" onClick={() => insightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FaBolt aria-hidden="true"/><span><b>Intelligence</b><small>{insights.length} recommendations</small></span><FaArrowRight aria-hidden="true"/></button>
            <button type="button" onClick={() => capacityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FaBed aria-hidden="true"/><span><b>Capacity</b><small>{bedManagementBoard.length} wards tracked</small></span><FaArrowRight aria-hidden="true"/></button>
            <button type="button" onClick={() => handoverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FaClipboardList aria-hidden="true"/><span><b>Handover</b><small>{handoverSavedAt ? 'Brief saved' : 'Brief pending'}</small></span><FaArrowRight aria-hidden="true"/></button>
          </nav>

          <details className="dashboard-analytics-drawer">
            <summary>
              <span><FaChartBar aria-hidden="true" /><b>Operational analytics</b><small>Open supporting charts and activity trends</small></span>
              <FaArrowRight aria-hidden="true" />
            </summary>
            <div className="dashboard-analytics-drawer-body">
              <div className="dashboard-charts-row">
                <KPIBarChart data={barChartData} />
                <StatusPieChart data={statusPieData} />
              </div>
              <div className="dashboard-charts-row">
                <TopDoctors appointments={appointments} />
                <RecentActivities activities={recentActivities} />
              </div>
            </div>
          </details>

          <div ref={insightRef}>
            <AiInsightPanel insights={insights} />
          </div>

          <section className="dashboard-warnings" aria-label="Operational warning signals" ref={warningsRef}>
            {earlyWarnings.map((item) => (
              <article key={item.title} className={`dashboard-warning-card dashboard-warning-${item.level}`}>
                <h4>{item.title}</h4>
                <b>{item.value}</b>
                <p>{item.hint}</p>
              </article>
            ))}
          </section>

          <section className="dashboard-shift-command" aria-label="Shift command center">
            <div className="section-head-row">
              <h3>Shift Command Center</h3>
              <span className="section-chip">Live Shift Status</span>
            </div>
            <div className="shift-grid">
              {shiftCommand.map((item) => (
                <article key={item.id} className={`shift-card shift-${item.level}`}>
                  <h4>{item.label}</h4>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-journey" aria-label="Patient journey board">
            <div className="section-head-row">
              <h3>Patient Journey Board</h3>
              <span className="section-chip">Flow by Care Stage</span>
            </div>
            <div className="journey-grid">
              {patientJourneyBoard.map((item) => (
                <article key={item.id} className="journey-card">
                  <div className="journey-top">
                    <strong>{item.stage}</strong>
                    <span>{item.target}</span>
                  </div>
                  <b>{item.count} patient(s)</b>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-critical-care" aria-label="Critical care board" ref={capacityRef}>
            <div className="section-head-row">
              <h3>ER & ICU Operations</h3>
              <span className={`section-chip ${socketLinkState === 'connected' ? 'section-chip-live' : ''}`}>
                Realtime Link: {socketLinkState}
              </span>
            </div>
            <p className="realtime-meta">Last event: {lastRealtimeAt} | Critical (15m): {criticalEventsLast15m}</p>
            <div className="critical-care-grid">
              {criticalCareBoard.map((item) => (
                <article key={item.id} className={`critical-card critical-${item.level}`}>
                  <div className="critical-top">
                    <strong>{item.unit}</strong>
                    <span>{item.status}</span>
                  </div>
                  <p>{item.metric}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-bed-board" aria-label="Bed management board">
            <div className="section-head-row">
              <h3>Bed Management Board</h3>
              <span className="section-chip">Capacity by Ward</span>
            </div>
            <div className="bed-board-grid">
              {bedManagementBoard.map((item) => (
                <article key={item.id} className={`bed-card bed-${item.level}`}>
                  <div className="bed-top">
                    <strong>{item.ward}</strong>
                    <span>{item.usage}%</span>
                  </div>
                  <p>{item.occupied}/{item.total} beds occupied</p>
                  <div className="bed-progress-track" role="presentation">
                    <span className="bed-progress-fill" style={{ width: `${item.usage}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-handover" aria-label="SBAR handover" ref={handoverRef}>
            <div className="section-head-row">
              <h3>SBAR Shift Handover</h3>
              <div className="handover-head-actions">
                <span className="section-chip">Nurse Station Brief</span>
                <button type="button" className="feed-toggle-btn" onClick={saveHandoverDraft}>Save Brief</button>
              </div>
            </div>
            <div className="handover-grid">
              <article className="handover-card">
                <h4>S: Situation</h4>
                <textarea
                  className="handover-input"
                  value={shiftHandover.situation}
                  onChange={(event) => setHandoverDraft((prev) => ({ ...prev, situation: event.target.value }))}
                />
              </article>
              <article className="handover-card">
                <h4>B: Background</h4>
                <textarea
                  className="handover-input"
                  value={shiftHandover.background}
                  onChange={(event) => setHandoverDraft((prev) => ({ ...prev, background: event.target.value }))}
                />
              </article>
              <article className="handover-card">
                <h4>A: Assessment</h4>
                <textarea
                  className="handover-input"
                  value={shiftHandover.assessment}
                  onChange={(event) => setHandoverDraft((prev) => ({ ...prev, assessment: event.target.value }))}
                />
              </article>
              <article className="handover-card">
                <h4>R: Recommendation</h4>
                <textarea
                  className="handover-input"
                  value={shiftHandover.recommendation}
                  onChange={(event) => setHandoverDraft((prev) => ({ ...prev, recommendation: event.target.value }))}
                />
              </article>
            </div>
            <p className="handover-saved">Last saved: {handoverSavedAt || 'Not saved yet'}</p>
            <p className="handover-saved">Status: {handoverSaveStatus || 'Not synced yet'}</p>
            <div className="handover-history">
              <div className="handover-head-row">
                <b>Recent Handover History</b>
                <button
                  type="button"
                  className="feed-toggle-btn"
                  onClick={async () => {
                    try {
                      await downloadInnovationHandoverCsv();
                    } catch {
                      setHandoverSaveStatus('Unable to export handover CSV');
                    }
                  }}
                >
                  Export Handover CSV
                </button>
              </div>
              <div className="handover-filter-row">
                <input
                  className="handover-filter-input"
                  placeholder="Filter by author"
                  value={handoverFilters.authoredBy}
                  onChange={(event) => setHandoverFilters((prev) => ({ ...prev, authoredBy: event.target.value }))}
                />
                <input
                  className="handover-filter-input"
                  type="date"
                  value={handoverFilters.fromDate}
                  onChange={(event) => setHandoverFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                />
                <input
                  className="handover-filter-input"
                  type="date"
                  value={handoverFilters.toDate}
                  onChange={(event) => setHandoverFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                />
                <button
                  type="button"
                  className="feed-toggle-btn"
                  onClick={() => {
                    setHandoverPagination((prev) => ({ ...prev, page: 1 }));
                    reloadHandoverHistory(handoverFilters, 1);
                  }}
                >
                  Apply
                </button>
              </div>
              <ul>
                {handoverHistory.length
                  ? handoverHistory.map((item) => (
                    <li key={`${item.handoverId}-${item.savedAt}`}>
                      {item.savedAt} - {item.authoredBy || 'unknown'} - {String(item.situation || '').slice(0, 88)}
                    </li>
                  ))
                  : <li>No previous handover in this environment.</li>}
              </ul>
              <div className="handover-pagination-row">
                <button
                  type="button"
                  className="feed-toggle-btn"
                  disabled={handoverPagination.page <= 1}
                  onClick={() => {
                    setHandoverPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
                  }}
                >
                  Prev
                </button>
                <span className="handover-page-meta">Page {handoverPagination.page} / {handoverPagination.totalPages || 1}</span>
                <button
                  type="button"
                  className="feed-toggle-btn"
                  disabled={handoverPagination.page >= (handoverPagination.totalPages || 1)}
                  onClick={() => {
                    setHandoverPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }));
                  }}
                >
                  Next
                </button>
              </div>
            </div>
            <div className="handover-history">
              <div className="handover-head-row">
                <b>Handover Audit Log</b>
                <div className="handover-head-actions">
                  <button type="button" className="feed-toggle-btn" onClick={reloadHandoverAudits}>Refresh Audits</button>
                  <button
                    type="button"
                    className="feed-toggle-btn"
                    onClick={async () => {
                      try {
                        await downloadInnovationHandoverAuditsCsv();
                      } catch {
                        setHandoverSaveStatus('Unable to export audit CSV');
                      }
                    }}
                  >
                    Export Audit CSV
                  </button>
                </div>
              </div>
              <ul>
                {handoverAuditLogs.length
                  ? handoverAuditLogs.map((item) => (
                    <li key={`${item.auditId}-${item.loggedAt}`}>
                      {item.loggedAt} - {item.eventType} - {item.actor}
                    </li>
                  ))
                  : <li>No audit records available.</li>}
              </ul>
            </div>
            <div className="handover-unresolved">
              <b>Unresolved Tasks</b>
              <ul>
                {shiftHandover.unresolved.length ? shiftHandover.unresolved.map((task) => <li key={task}>{task}</li>) : <li>No open items.</li>}
              </ul>
            </div>
          </section>

          <section className="dashboard-mission" ref={missionRef} aria-label="Mission control queue">
            <div className="section-head-row">
              <h3>Mission Control Queue</h3>
              <span className="section-chip">Autopilot: {autopilotMode}</span>
            </div>
            <div className="mission-grid">
              {missionQueue.map((item) => (
                <article key={item.id} className="mission-card">
                  <div className="mission-top">
                    <strong>{item.title}</strong>
                    <span className="mission-score">Priority {item.score}</span>
                  </div>
                  <p>{item.detail}</p>
                  <div className="mission-meta">
                    <span>Owner: {item.owner}</span>
                    <span>ETA: {item.eta}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-live-feed" ref={feedRef} aria-label="Live operations feed">
            <div className="section-head-row">
              <h3>Live Operations Feed</h3>
              <button
                type="button"
                className="feed-toggle-btn"
                onClick={() => setFeedRunning((prev) => !prev)}
              >
                {feedRunning ? 'Pause Feed' : 'Resume Feed'}
              </button>
            </div>
            <ul className="live-feed-list">
              {feedWindow.map((event) => (
                <li key={event.id} className={`feed-item feed-${event.severity}`}>
                  <div className="feed-main">
                    <b>{event.title}</b>
                    <span>{event.detail}</span>
                  </div>
                  <div className="feed-side">
                    <small>{event.channel}</small>
                    <time>{event.at}</time>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="dashboard-scenarios" aria-label="Autopilot scenarios">
            <div className="section-head-row">
              <h3>Autopilot Scenarios</h3>
            </div>
            <div className="scenario-row">
              <button type="button" className={`scenario-btn ${autopilotMode === 'balanced' ? 'scenario-btn-active' : ''}`} onClick={() => setAutopilotMode('balanced')}>Balanced Mode</button>
              <button type="button" className={`scenario-btn ${autopilotMode === 'growth' ? 'scenario-btn-active' : ''}`} onClick={() => setAutopilotMode('growth')}>Growth Sprint</button>
              <button type="button" className={`scenario-btn ${autopilotMode === 'recovery' ? 'scenario-btn-active' : ''}`} onClick={() => setAutopilotMode('recovery')}>Recovery Mode</button>
            </div>
          </section>

          {kpi.conflictCount > 0 && (
            <div className="alert-box alert-warning">
              <span style={{fontSize: 20}}>⚠</span>
              <span>Conflict detected: {kpi.conflictCount} duplicate time-slot(s) for the same doctor on {today}.</span>
            </div>
          )}

          <div className="dashboard-action-row">
            <button onClick={() => handleShortcut('book')} className="action-button action-primary">
              <FaCalendarAlt/> Book New Appointment
            </button>
            <button onClick={() => handleShortcut('schedule')} className="action-button action-secondary">
              <FaUserMd/> Doctor Schedules
            </button>
            <button onClick={() => handleShortcut('kpi')} className="action-button action-secondary">
              <FaChartBar/> KPI Reports
            </button>
          </div>

          <div className="dashboard-bottom">
            <div className="quick-links">
              <div className="quick-links-title">Quick Links</div>
              <ul className="quick-link-list">
                <li><Link to={`/${ROUTES.APPOINTMENTS}`}>Book New Appointment</Link></li>
                <li><Link to={`/${ROUTES.PATIENTS}`}>Add New Patient</Link></li>
                <li><Link to={`/${ROUTES.DOCTORS}`}>Doctor Schedules</Link></li>
                <li><Link to={`/${ROUTES.REPORTS}`}>View Reports</Link></li>
              </ul>
            </div>
            <div className="dashboard-announcements">
              <div className="announcements-title">Announcements</div>
              <div className="announcement-item">Remote triage pilot is active for chronic follow-up cohort this week.</div>
              <div className="announcement-item">Digital check-in kiosk v2 rollout starts tomorrow at 09:00.</div>
              <div className="announcement-item">New preventive care KPI dashboard is now available in Reports.</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

