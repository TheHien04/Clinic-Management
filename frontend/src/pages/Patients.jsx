import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import PatientModal from '../components/PatientModal';
import PatientForm from '../components/PatientForm';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { formatMonthShort } from '../utils/i18nFormat';
import './Patients.css';
import './Common.css';

// Mock appointments for chart (April, May, June, July, August) - up/down for chart beauty
const mockAppointments = [
  { patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-04-15', email: 'vana@gmail.com', phone: '0901234567', warning: 'Chronic: Diabetes', dob: '1980-05-12' },
  { patient: 'Nguyen Thi H', doctor: 'Dr. Anna', date: '2025-04-20', email: 'thih@gmail.com', phone: '0906789123', warning: '', dob: '1972-11-03' },
  { patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-05-10', email: 'thib@gmail.com', phone: '0902345678', warning: '', dob: '2005-09-20' },
  { patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-06-05', email: 'vanc@gmail.com', phone: '0903456789', warning: 'Chronic: Hypertension', dob: '1950-03-01' },
  { patient: 'Hoang Minh G', doctor: 'Dr. John', date: '2025-06-11', email: 'minhg@gmail.com', phone: '0905678912', warning: 'Chronic: Asthma', dob: '2010-07-22' },
  { patient: 'Pham Thi D', doctor: 'Dr. Smith', date: '2025-07-22', email: 'thid@gmail.com', phone: '0904567890', warning: '', dob: '1995-12-15' },
  { patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', email: 'vana@gmail.com', phone: '0901234567', warning: 'Chronic: Diabetes', dob: '1980-05-12' },
  { patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-08-29', email: 'thib@gmail.com', phone: '0902345678', warning: '', dob: '2005-09-20' },
  { patient: 'Le Van C', doctor: 'Dr. Anna', date: '2025-08-30', email: 'vanc@gmail.com', phone: '0903456789', warning: 'Chronic: Hypertension', dob: '1950-03-01' },
  { patient: 'Pham Thi D', doctor: 'Dr. Smith', date: '2025-08-30', email: 'thid@gmail.com', phone: '0904567890', warning: '', dob: '1995-12-15' },
  { patient: 'Hoang Minh G', doctor: 'Dr. John', date: '2025-08-11', email: 'minhg@gmail.com', phone: '0905678912', warning: 'Chronic: Asthma', dob: '2010-07-22' },
  // Add more for up/down effect
  { patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-05-15', email: 'vana@gmail.com', phone: '0901234567', warning: 'Chronic: Diabetes', dob: '1980-05-12' },
  { patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-07-10', email: 'thib@gmail.com', phone: '0902345678', warning: '', dob: '2005-09-20' },
  { patient: 'Le Van C', doctor: 'Dr. Anna', date: '2025-06-30', email: 'vanc@gmail.com', phone: '0903456789', warning: 'Chronic: Hypertension', dob: '1950-03-01' },
  { patient: 'Pham Thi D', doctor: 'Dr. Smith', date: '2025-05-22', email: 'thid@gmail.com', phone: '0904567890', warning: '', dob: '1995-12-15' },
  { patient: 'Hoang Minh G', doctor: 'Dr. John', date: '2025-07-11', email: 'minhg@gmail.com', phone: '0905678912', warning: 'Chronic: Asthma', dob: '2010-07-22' },
  { patient: 'Nguyen Thi H', doctor: 'Dr. Anna', date: '2025-06-20', email: 'thih@gmail.com', phone: '0906789123', warning: '', dob: '1972-11-03' },
  // September patient for demo
  { patient: 'Pham Van K', doctor: 'Dr. Smith', date: '2025-09-05', email: 'phamk@gmail.com', phone: '0909999999', warning: '', dob: '1990-01-01' }
];

const basePatients = [
  { id: 1, name: 'Nguyen Van A', email: 'vana@gmail.com', phone: '0901234567', warning: 'Chronic: Diabetes', dob: '1980-05-12' },
  { id: 2, name: 'Tran Thi B', email: 'thib@gmail.com', phone: '0902345678', warning: '', dob: '2005-09-20' },
  { id: 3, name: 'Le Van C', email: 'vanc@gmail.com', phone: '0903456789', warning: 'Chronic: Hypertension', dob: '1950-03-01' },
  { id: 4, name: 'Pham Thi D', email: 'thid@gmail.com', phone: '0904567890', warning: '', dob: '1995-12-15' },
  { id: 5, name: 'Hoang Minh G', email: 'minhg@gmail.com', phone: '0905678912', warning: 'Chronic: Asthma', dob: '2010-07-22' },
  { id: 6, name: 'Nguyen Thi H', email: 'thih@gmail.com', phone: '0906789123', warning: '', dob: '1972-11-03' },
];

// Thêm mockdata lịch hẹn hôm nay, giờ gần hiện tại để demo "Lịch hẹn trong 2 giờ tới"
const now = new Date();
const todayStr = now.toISOString().slice(0, 10);
const hour = now.getHours();
const minute = now.getMinutes();
const pad = n => n.toString().padStart(2, '0');
mockAppointments.push({
  patient: 'Nguyen Van M',
  doctor: 'Dr. John',
  date: todayStr,
  email: 'nguyenm@gmail.com',
  phone: '0908888888',
  warning: '',
  dob: '1992-02-02',
  time: pad(hour) + ':' + pad((minute + 30) % 60), // giờ hiện tại + 30 phút
  status: 'Confirmed'
});

export default function Patients() {
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [chronicFilter, setChronicFilter] = useState(false);
  const [emailFilter, setEmailFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [idFilter, setIdFilter] = useState('');
  const [lastVisitFilter, setLastVisitFilter] = useState('');
  const [visitCountFilter, setVisitCountFilter] = useState('');
  const [modalPatient, setModalPatient] = useState(null);
  const [modalHistory, setModalHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const searchInputRef = useRef(null);
  const growthRef = useRef(null);
  const tableRef = useRef(null);
  const riskRef = useRef(null);
  const outreachRef = useRef(null);

  // Lấy danh sách bệnh nhân duy nhất từ appointments và patients
  // Mock: enrich patients with more info
  // Mock: enrich patients with more info (chronic, email, phone)
  // Mock base data and appointments for all pages (April, June, August)
  // Use mockAppointments for all pages
  const patientList = useMemo(() => {
    const all = [...basePatients];
    mockAppointments.forEach(app => {
      if (!all.find(p => p.name === app.patient)) {
        all.push({
          id: all.length + 1,
          name: app.patient,
          email: app.email || '',
          phone: app.phone || '',
          warning: app.warning || '',
          dob: app.dob || '',
        });
      }
    });
    return all;
  }, []);

  // Lọc nâng cao & tìm kiếm thông minh
  const filtered = patientList.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(search.toLowerCase());
    const emailMatch = !emailFilter || (p.email && p.email.toLowerCase().includes(emailFilter.toLowerCase()));
    const phoneMatch = !phoneFilter || (p.phone && p.phone.includes(phoneFilter));
    const idMatch = !idFilter || String(p.id).includes(idFilter);
    const chronicMatch = !chronicFilter || (p.warning && p.warning.toLowerCase().includes('chronic'));
    const doctorMatch = !doctorFilter || mockAppointments.some(a => a.patient === p.name && a.doctor === doctorFilter);
    const history = mockAppointments.filter(a => a.patient === p.name);
    const lastVisit = history.length ? history[history.length - 1].date : '';
    const lastVisitMatch = !lastVisitFilter || (lastVisit && lastVisit >= lastVisitFilter);
    const visitCountMatch = !visitCountFilter || history.length >= Number(visitCountFilter);
    return nameMatch && emailMatch && phoneMatch && idMatch && chronicMatch && doctorMatch && lastVisitMatch && visitCountMatch;
  });

  // Show only patients with last visit in the last 6 months
  const recentMonths = (() => {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  })();
  const filteredRecent = filtered.filter(p => {
    const history = mockAppointments.filter(a => a.patient === p.name);
    const lastVisit = history.length ? history[history.length - 1].date : '';
    return recentMonths.some(m => lastVisit.startsWith(m));
  });

  // Lấy lịch sử khám cho từng bệnh nhân
  const getHistory = (name) => mockAppointments.filter(a => a.patient === name);

  const patientRiskRows = useMemo(() => {
    const today = new Date();

    return filteredRecent.map((patient) => {
      const history = getHistory(patient.name);
      const lastVisit = history.length ? history[history.length - 1].date : '';
      const age = patient.dob ? Math.floor((today.getTime() - new Date(patient.dob).getTime()) / 3.15576e10) : 35;
      const chronic = patient.warning?.toLowerCase().includes('chronic');
      const visits = history.length;

      let daysSinceLastVisit = 180;
      if (lastVisit) {
        const delta = today.getTime() - new Date(lastVisit).getTime();
        daysSinceLastVisit = Math.max(0, Math.round(delta / (24 * 60 * 60 * 1000)));
      }

      const riskScore = Math.min(100,
        (chronic ? 38 : 10) +
        (age >= 65 ? 22 : age < 18 ? 12 : 16) +
        Math.min(24, daysSinceLastVisit * 0.12) +
        Math.min(16, visits * 2)
      );

      const riskBand = riskScore >= 70 ? 'high' : riskScore >= 45 ? 'medium' : 'low';
      const outreachPriority = riskBand === 'high' ? '24h nurse call + tele-consult' : riskBand === 'medium' ? '48h reminder + care coach' : 'Monthly preventive nudge';

      return {
        id: patient.id,
        name: patient.name,
        visits,
        lastVisit: lastVisit || 'N/A',
        riskScore: Math.round(riskScore),
        riskBand,
        outreachPriority,
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [filteredRecent]);

  const riskCohorts = useMemo(() => {
    const high = patientRiskRows.filter((row) => row.riskBand === 'high');
    const medium = patientRiskRows.filter((row) => row.riskBand === 'medium');
    const low = patientRiskRows.filter((row) => row.riskBand === 'low');
    return {
      high: { count: high.length, avg: high.length ? Math.round(high.reduce((sum, row) => sum + row.riskScore, 0) / high.length) : 0 },
      medium: { count: medium.length, avg: medium.length ? Math.round(medium.reduce((sum, row) => sum + row.riskScore, 0) / medium.length) : 0 },
      low: { count: low.length, avg: low.length ? Math.round(low.reduce((sum, row) => sum + row.riskScore, 0) / low.length) : 0 },
    };
  }, [patientRiskRows]);

  const outreachQueue = useMemo(() => {
    return patientRiskRows
      .filter((row) => row.riskBand !== 'low')
      .map((row, index) => ({
        ...row,
        etaHours: row.riskBand === 'high' ? 24 : 48,
        queueRank: index + 1,
      }))
      .slice(0, 8);
  }, [patientRiskRows]);

  // CRUD
  const handleAdd = () => { setEditPatient(null); setShowForm(true); };
  const handleEdit = (p) => { setEditPatient(p); setShowForm(true); };
  const handleDelete = (p) => {
    if (window.confirm('Delete patient ' + p.name + '?')) {
      // Just show alert for demo
      alert('Deleted patient: ' + p.name);
    }
  };
  const handleSave = (data) => {
    // Just show alert for demo
    alert('Saved patient: ' + data.name);
    setShowForm(false);
  };

  // Modal chi tiết
  const handleView = (p) => {
    setModalPatient(p);
    setModalHistory(getHistory(p.name));
  };
  const handleCloseModal = () => setModalPatient(null);
  const handleBook = () => {
    alert('Book re-exam for ' + modalPatient.name);
    setModalPatient(null);
  };

  // Download PDF mock
  const handleDownload = (p) => {
    alert('Download PDF for ' + p.name);
  };

  // Lấy danh sách bác sĩ
  const doctorList = useMemo(() => {
    const set = new Set();
    mockAppointments.forEach(a => set.add(a.doctor));
    return Array.from(set);
  }, []);

  // Thống kê nhanh
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const stats = useMemo(() => {
    let chronic = 0, newThisMonth = 0;
    patientList.forEach(p => {
      if (p.warning && p.warning.toLowerCase().includes('chronic')) chronic++;
      const history = mockAppointments.filter(a => a.patient === p.name);
      if (history.length && history[history.length - 1].date && history[history.length - 1].date.startsWith(thisMonth)) newThisMonth++;
    });
    return { total: patientList.length, chronic, newThisMonth };
  }, [patientList, thisMonth]);

  // Pie chart data
  const pieData = [
    { name: 'Chronic', value: stats.chronic },
    { name: 'New', value: stats.newThisMonth },
    { name: 'Other', value: stats.total - stats.chronic - stats.newThisMonth }
  ];
  const pieColors = ['var(--success-fg)', 'var(--warning-fg)', 'var(--brand-500)'];

  const formatMonthLabel = (month) => {
    const [year, mon] = month.split('-').map(Number);
    return formatMonthShort(new Date(year, mon - 1, 1));
  };

  const pieTooltipFormatter = (value, name) => {
    const total = pieData.reduce((sum, item) => sum + item.value, 0);
    const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
    return [`${value} (${percent}%)`, name];
  };

  const growthTooltipFormatter = (value) => [`${value} patients`, 'New Patients'];

  const runPatientsCommand = useCallback((action) => {
    if (!action) return;

    if (action === 'add') {
      setEditPatient(null);
      setShowForm(true);
      return;
    }

    if (action === 'filter-chronic') {
      setChronicFilter(true);
      return;
    }

    if (action === 'clear-filters') {
      setSearch('');
      setDoctorFilter('');
      setChronicFilter(false);
      setEmailFilter('');
      setPhoneFilter('');
      setIdFilter('');
      setLastVisitFilter('');
      setVisitCountFilter('');
      return;
    }

    if (action === 'focus-search') {
      searchInputRef.current?.focus();
      return;
    }

    if (action === 'jump-growth') {
      growthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-table') {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-risk') {
      riskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-outreach') {
      outreachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'focus-high-risk') {
      setChronicFilter(true);
      riskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const urlAction = new URLSearchParams(window.location.search).get('cp_action');
    if (urlAction) {
      runPatientsCommand(urlAction);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const onCommand = (event) => {
      const action = event?.detail?.action;
      runPatientsCommand(action);
    };

    window.addEventListener('patients:command', onCommand);
    return () => window.removeEventListener('patients:command', onCommand);
  }, [runPatientsCommand]);

  // Mini chart: số bệnh nhân mới từng tháng (hiển thị 6 tháng gần nhất, kể cả tháng không có bệnh nhân)
  const patientGrowthData = useMemo(() => {
    const monthMap = {};
    mockAppointments.forEach(a => {
      if (a.date) {
        const month = a.date.slice(0, 7); // yyyy-mm
        if (!monthMap[month]) monthMap[month] = new Set();
        monthMap[month].add(a.patient);
      }
    });
    // Tạo mảng 6 tháng gần nhất
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.toISOString().slice(0, 7);
      months.push(m);
    }
    return months.map(month => ({
      month,
      count: monthMap[month] ? monthMap[month].size : 0
    }));
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="patients-content">
          <h2>Patients</h2>
          {/* Top section: stats/pie chart and patient growth chart side by side, then new patients box below */}
          <div className="patients-dashboard-stack">
            <div className="patients-dashboard-row">
              <div className="patients-stats-card">
                <div className="patients-stat-item patients-stat-total">Total<br/><span className="patients-stat-number">{stats.total}</span></div>
                <div className="patients-stat-item patients-stat-chronic">Chronic<br/><span className="patients-stat-number">{stats.chronic}</span></div>
                <div className="patients-stat-item patients-stat-new">New<br/><span className="patients-stat-number">{stats.newThisMonth}</span></div>
                <div className="patients-pie-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart className="patients-pie-chart">
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={55} paddingAngle={2} >
                        {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={pieColors[idx]} />)}
                      </Pie>
                      <Tooltip formatter={pieTooltipFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend dưới pie chart */}
                  <div className="patients-pie-legend">
                    <span className="patients-pie-legend-chronic">&#9679; Chronic</span>
                    <span className="patients-pie-legend-new">&#9679; New</span>
                    <span className="patients-pie-legend-other">&#9679; Other</span>
                  </div>
                </div>
              </div>
              {/* Patient Growth by Month chart to the right, same height */}
              <div className="patients-growth-card" ref={growthRef}>
                <div className="patients-growth-title">Patient Growth by Month</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={patientGrowthData} margin={{top:8,right:16,left:0,bottom:8}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
                    <XAxis dataKey="month" tick={{fontSize:13}} tickFormatter={formatMonthLabel} />
                    <YAxis allowDecimals={false} tick={{fontSize:13}} />
                    <Tooltip formatter={growthTooltipFormatter} labelFormatter={formatMonthLabel} />
                    <Bar dataKey="count" fill="var(--brand-500)" radius={[8,8,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* New Patients This Month box - prominent, colored, with icon */}
            <div className="patients-new-card">
              <span className="patients-new-title">
                <span role="img" aria-label="new-patient" className="patients-new-icon">👤</span>
                New Patients This Month
              </span>
              <span className="patients-new-value">{stats.newThisMonth}</span>
            </div>
          </div>
          <div className="patients-search-row">
            {/* Filter summary/info block to fill whitespace */}
            <div className="patients-filter-summary">
              <span role="img" aria-label="filter" className="patients-filter-icon">🔎</span>
              <div className="patients-filter-content">
                <div className="patients-filter-title">Filters</div>
                <div className="patients-filter-values">
                  {search && <span>Name: <b>{search}</b> </span>}
                  {emailFilter && <span>Email: <b>{emailFilter}</b> </span>}
                  {phoneFilter && <span>Phone: <b>{phoneFilter}</b> </span>}
                  {idFilter && <span>ID: <b>{idFilter}</b> </span>}
                  {lastVisitFilter && <span>Last Visit: <b>{lastVisitFilter}</b> </span>}
                  {visitCountFilter && <span>Visits ≥ <b>{visitCountFilter}</b> </span>}
                  {doctorFilter && <span>Doctor: <b>{doctorFilter}</b> </span>}
                  {chronicFilter && <span>Chronic only </span>}
                  {(!search && !doctorFilter && !chronicFilter && !emailFilter && !phoneFilter && !idFilter && !lastVisitFilter && !visitCountFilter) && <span className="patients-filter-none">No filters applied, showing all patients.</span>}
                </div>
              </div>
            </div>
            {/* ...existing code... */}
            <input ref={searchInputRef} type="text" placeholder="Name..." value={search} onChange={e => setSearch(e.target.value)} className="patients-search-input patients-input-md" />
            <input type="text" placeholder="Email..." value={emailFilter} onChange={e => setEmailFilter(e.target.value)} className="patients-search-input patients-input-md" />
            <input type="text" placeholder="Phone..." value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)} className="patients-search-input patients-input-sm" />
            <input type="text" placeholder="ID..." value={idFilter} onChange={e => setIdFilter(e.target.value)} className="patients-search-input patients-input-xs" />
            <input type="date" placeholder="Last Visit..." value={lastVisitFilter} onChange={e => setLastVisitFilter(e.target.value)} className="patients-search-input patients-input-md" />
            <input type="number" min="1" placeholder="Visits ≥..." value={visitCountFilter} onChange={e => setVisitCountFilter(e.target.value)} className="patients-search-input patients-input-count" />
            <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="patients-search-input patients-input-md">
              <option value="">All Doctors</option>
              {doctorList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="patients-toggle">
              <input type="checkbox" checked={chronicFilter} onChange={e => setChronicFilter(e.target.checked)} /> Chronic only
            </label>
            <button className="patients-add-btn" onClick={handleAdd}><EditIcon /> Add Patient</button>
          </div>

          <section className="patients-risk-section" ref={riskRef}>
            <h3>Precision Patient Risk Cohorts</h3>
            <div className="patients-risk-grid">
              <article>
                <span>High Risk</span>
                <b>{riskCohorts.high.count}</b>
                <small>Avg score: {riskCohorts.high.avg}</small>
              </article>
              <article>
                <span>Medium Risk</span>
                <b>{riskCohorts.medium.count}</b>
                <small>Avg score: {riskCohorts.medium.avg}</small>
              </article>
              <article>
                <span>Low Risk</span>
                <b>{riskCohorts.low.count}</b>
                <small>Avg score: {riskCohorts.low.avg}</small>
              </article>
            </div>
          </section>

          <section className="patients-risk-section" ref={outreachRef}>
            <h3>Proactive Outreach Queue</h3>
            <div className="patients-table-wrapper">
              <table className="patients-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Patient</th>
                    <th>Risk Score</th>
                    <th>Band</th>
                    <th>Last Visit</th>
                    <th>ETA</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outreachQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7}>No medium/high-risk patients in current filter scope.</td>
                    </tr>
                  ) : outreachQueue.map((row) => (
                    <tr key={`outreach-${row.id}`}>
                      <td>{row.queueRank}</td>
                      <td>{row.name}</td>
                      <td>{row.riskScore}</td>
                      <td><span className={`patient-badge ${row.riskBand === 'high' ? 'patient-badge-elderly' : 'patient-badge-chronic'}`}>{row.riskBand}</span></td>
                      <td>{row.lastVisit}</td>
                      <td>{row.etaHours}h</td>
                      <td>{row.outreachPriority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="patients-table-wrapper" ref={tableRef}>
            <table className="patients-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Visits</th>
                  <th>Last Visit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecent.map((p) => {
                  const history = getHistory(p.name);
                  const lastVisit = history.length ? history[history.length - 1].date : '-';
                  // Badge logic
                  let badge = null;
                  if (p.warning && p.warning.toLowerCase().includes('chronic')) badge = <span className="patient-badge patient-badge-chronic">Chronic</span>;
                  else if (p.dob) {
                    const age = Math.floor((new Date().getTime() - new Date(p.dob).getTime())/3.15576e10);
                    if (age < 16) badge = <span className="patient-badge patient-badge-child">Child</span>;
                    else if (age > 65) badge = <span className="patient-badge patient-badge-elderly">Elderly</span>;
                  }
                  return (
                    <tr key={p.id} className="patients-row">
                      <td>{p.id}</td>
                      <td className="patients-name-cell" onClick={() => handleView(p)}>{p.name} {badge}</td>
                      <td>{p.email}</td>
                      <td>{p.phone}</td>
                      <td>{history.length}</td>
                      <td>{lastVisit}</td>
                      <td className="patients-actions-cell">
                        <button title="View Record" className="patients-btn patients-btn-view" onClick={() => handleView(p)}><DetailsIcon />View</button>
                        {history.length > 0 && (
                          <button title="Download PDF" className="patients-btn patients-btn-outline" onClick={() => handleDownload(p)}><EditIcon />PDF</button>
                        )}
                        <button title="Edit" className="patients-btn patients-btn-outline" onClick={() => handleEdit(p)}><EditIcon />Edit</button>
                        <button title="Delete" className="patients-btn patients-btn-danger" onClick={() => handleDelete(p)}><DeleteIcon />Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="patients-features">
            <div className="patients-feature-block">
              <div className="patients-feature-title">Patient Management</div>
              <div className="patients-feature-desc">
                <ul>
                  <li>Centralized management of patient medical records by patient code.</li>
                  <li>View visit history, doctor, and re-exam schedule.</li>
                  <li>Download PDF copy of medical record (if available).</li>
                  <li>Data privacy: Only viewable by the patient (HIPAA-like).</li>
                </ul>
              </div>
            </div>
            <div className="patients-feature-block">
              <div className="patients-feature-title">Quick Actions</div>
              <div className="patients-feature-desc">
                <ul>
                  <li>Search for patients by name.</li>
                  <li>View and download medical records.</li>
                  <li>See visit count and last visit date.</li>
                </ul>
              </div>
            </div>
          </div>
          {modalPatient && (
            <PatientModal
              open={!!modalPatient}
              onClose={handleCloseModal}
              patient={modalPatient}
              history={modalHistory}
              onBook={handleBook}
              onEdit={() => { setEditPatient(modalPatient); setShowForm(true); setModalPatient(null); }}
              onDelete={() => { handleDelete(modalPatient); setModalPatient(null); }}
            />
          )}
          {showForm && (
            <PatientForm
              open={showForm}
              onClose={() => setShowForm(false)}
              onSave={handleSave}
              patient={editPatient}
            />
          )}
        </main>
      </div>
    </div>
  );
}
