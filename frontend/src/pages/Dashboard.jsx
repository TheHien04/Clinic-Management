
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaUserMd, FaUser, FaChartBar, FaHeartbeat, FaRobot } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Dashboard.css';
import './Common.css';
import { ROUTES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';

const OPS_ALERTS_EVENT = 'ops-alerts:update';
const DASHBOARD_AUTOPILOT_KEY = 'dashboard_autopilot_mode_v1';

const pieColors = ['#0a7ea4', '#f29f05', '#1f8a5c', '#d64545', '#457b9d'];
const statusWeight = {
  completed: 0,
  confirmed: 0,
  pending: 1,
  cancelled: 2,
};

const statusLabel = {
  completed: 'Completed',
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

// PieChart tỷ lệ trạng thái appointments
function StatusPieChart({ data }) {
  return (
    <div className="chart-widget">
      <div className="chart-widget-title">Appointment Mix</div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => `${entry.name}: ${entry.percent ? (entry.percent * 100).toFixed(0) : 0}%`}
          >
            {data.map((entry, idx) => <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => [`${value} appointments`, 'Volume']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="chart-legend-row">
        {data.map((d,idx) => (
          <span key={d.name} className="legend-item">
            <span className="legend-swatch" style={{ background: pieColors[idx % pieColors.length] }} />
            {d.name}: <b>{d.value}</b>
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
  return (
    <div className="chart-widget">
      <div className="chart-widget-title">Top Doctors (Most Appointments)</div>
      <ul className="unstyled-list">
        {top.map(([name,count],idx) => (
          <li key={name} className="top-doctor-item">
            <span className="rank-pill">{idx + 1}</span>
            {name} <span className="subtle">({count} appointments)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Widget Recent Activities
function RecentActivities({ activities }) {
  return (
    <div className="chart-widget">
      <div className="chart-widget-title">Recent Activities</div>
      <ul className="unstyled-list">
        {activities.length === 0 ? <li className="subtle">No recent activities.</li> : activities.map((act,idx) => (
          <li key={idx} className="activity-item">{act}</li>
        ))}
      </ul>
    </div>
  );
}

function KPIBarChart({ data }) {
  return (
    <div className="chart-widget">
      <div className="chart-widget-title">Operational Load - Last 7 Days</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8eef6" />
          <XAxis dataKey="date" tickFormatter={d => d.slice(5)} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(value) => [`${value} appointments`, 'Volume']} />
          <Legend />
          <Bar dataKey="count" fill="#0a7ea4" name="Appointments" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
  const missionRef = useRef(null);
  const feedRef = useRef(null);
  const [feedRunning, setFeedRunning] = useState(true);
  const [feedCursor, setFeedCursor] = useState(4);
  const [autopilotMode, setAutopilotMode] = useState(
    () => localStorage.getItem(DASHBOARD_AUTOPILOT_KEY) || 'balanced'
  );
  const [opsStreamEvents, setOpsStreamEvents] = useState([]);

  const { appointments, patients, doctors } = useMemo(() => {
    const appointments = [
      { id: 1, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'confirmed' },
      { id: 2, patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-08-29', time: '10:00', status: 'pending' },
      { id: 3, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-29', time: '11:00', status: 'completed' },
      { id: 4, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-29', time: '13:00', status: 'completed' },
      { id: 5, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'confirmed' },
      { id: 6, patient: 'Nguyen Van B', doctor: 'Dr. John', date: '2025-08-29', time: '15:00', status: 'pending' },
      { id: 7, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-28', time: '08:30', status: 'completed' },
      { id: 8, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-28', time: '11:00', status: 'cancelled' },
    ];
    const patients = [
      { id: 1, name: 'Nguyen Van A' },
      { id: 2, name: 'Tran Thi B' },
      { id: 3, name: 'Le Van C' },
      { id: 4, name: 'Pham Thi D' },
    ];
    const doctors = [
      { id: 1, name: 'Dr. Smith' },
      { id: 2, name: 'Dr. John' },
      { id: 3, name: 'Dr. Anna' },
    ];
    return { appointments, patients, doctors };
  }, []);

  const today = useMemo(() => appointments.map((a) => a.date).sort().slice(-1)[0], [appointments]);

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

      const mapped = alerts.slice(0, 8).map((alert, index) => {
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

      setOpsStreamEvents((prev) => {
        const seen = new Set((prev || []).map((item) => item.id));
        const merged = [...mapped.filter((item) => !seen.has(item.id)), ...(prev || [])];
        return merged.slice(0, 20);
      });
    };

    window.addEventListener(OPS_ALERTS_EVENT, onOpsAlertsUpdate);
    return () => window.removeEventListener(OPS_ALERTS_EVENT, onOpsAlertsUpdate);
  }, []);

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
        <main className="dashboard-content">
          <h2>Health Operations Command Center</h2>
          <p className="dashboard-subtitle"><FaHeartbeat /> Real-time visibility for appointment flow, capacity, and care continuity.</p>
          
          <div className="dashboard-stats-row">
            <div className="stats-container">
              <div className="stat-card">
                <div className="stat-title"><FaCalendarAlt style={{color:'#0a7ea4'}}/>Today's Appointments</div>
                <div className="stat-value">{kpi.today}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaUser style={{color:'#f29f05'}}/>Waiting</div>
                <div className="stat-value">{kpi.waiting}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaChartBar style={{color:'#1f8a5c'}}/>Completed</div>
                <div className="stat-value">{kpi.completed}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaUserMd style={{color:'#0a7ea4'}}/>Doctors</div>
                <div className="stat-value">{doctors.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaUser style={{color:'#0a7ea4'}}/>Patients</div>
                <div className="stat-value">{patients.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title"><FaHeartbeat style={{color:'#1f8a5c'}}/>Completion Rate</div>
                <div className="stat-value">{kpi.completionRate}%</div>
              </div>
            </div>
          </div>

          <div className="dashboard-charts-row">
            <KPIBarChart data={barChartData} />
            <StatusPieChart data={statusPieData} />
          </div>

          <div className="dashboard-charts-row">
            <TopDoctors appointments={appointments} />
            <RecentActivities activities={recentActivities} />
          </div>

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

