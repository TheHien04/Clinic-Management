import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Common.css';
import './Appointments.css';
import Spinner from '../components/Spinner';
import { ROUTES } from '../constants';

const StackedBarStatusChart = lazy(() => import('../components/StackedBarStatusChart'));
const AppointmentCalendarChart = lazy(() => import('../components/AppointmentCalendarChart'));
const DonutChart = lazy(() => import('../components/DonutChart'));


const initialAppointments = [
  { id: 1, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'confirmed', checkedIn: false, email: 'vana@gmail.com', phone: '0901234567' },
  { id: 2, patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-08-29', time: '10:00', status: 'pending', checkedIn: false, email: 'thib@gmail.com', phone: '0902345678' },
  { id: 3, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-30', time: '08:30', status: 'completed', checkedIn: true, email: 'vanc@gmail.com', phone: '0903456789' },
  { id: 4, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-30', time: '11:00', status: 'cancelled', checkedIn: false, email: 'thid@gmail.com', phone: '0904567890' },
  { id: 5, patient: 'Nguyen Thi E', doctor: 'Dr. John', date: '2025-08-29', time: '11:30', status: 'pending', checkedIn: false, email: 'thie@gmail.com', phone: '0905678901' },
  { id: 6, patient: 'Bui Van F', doctor: 'Dr. Smith', date: '2025-08-29', time: '14:00', status: 'confirmed', checkedIn: false, email: 'vanf@gmail.com', phone: '0906789012' },
];


import Toast from '../components/Toast';

export default function Appointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState({ doctor: '', status: '', date: '', search: '' });
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [loading, setLoading] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [denseTable, setDenseTable] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= 900);
  const [mobileActionsRowId, setMobileActionsRowId] = useState(null);
  const searchInputRef = useRef(null);
  const tableRef = useRef(null);
  const calendarRef = useRef(null);
  const smartQueueRef = useRef(null);
  const chartFallback = <div className="chart-loading">Loading chart...</div>;

  // Quick search & advanced filter
  const filteredAppointments = appointments.filter(item => {
    const doctorMatch = filter.doctor ? item.doctor === filter.doctor : true;
    const statusMatch = filter.status ? item.status === filter.status : true;
    const dateMatch = filter.date ? item.date === filter.date : true;
    const searchMatch = filter.search
      ? (item.patient.toLowerCase().includes(filter.search.toLowerCase()) ||
         item.doctor.toLowerCase().includes(filter.search.toLowerCase()) ||
         String(item.id).includes(filter.search))
      : true;
    return doctorMatch && statusMatch && dateMatch && searchMatch;
  });

  // Handler: open/close new appointment modal
  const handleOpenNew = () => setShowNewModal(true);
  const handleCloseNew = () => setShowNewModal(false);

  // Handler: open/close detail modal
  const handleShowDetail = (item) => setShowDetail(item);
  const handleCloseDetail = () => setShowDetail(null);

  // Handler: check-in (giả lập)
  const handleCheckIn = (id) => {
    setLoading(true);
    setTimeout(() => {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, checkedIn: true, status: a.status === 'confirmed' ? 'checked-in' : a.status } : a));
      setToast({ message: 'Check-in successful! Notification sent to patient.', type: 'success' });
      setLoading(false);
    }, 800);
  };

  // Handler: confirm appointment (giả lập)
  const handleConfirm = (id) => {
    setLoading(true);
    setTimeout(() => {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' } : a));
      setToast({ message: 'Appointment confirmed! Notification sent to patient.', type: 'success' });
      setLoading(false);
    }, 800);
  };

  // Handler: add new appointment (giả lập)
  const handleAddNew = (newApp) => {
    const hasConflict = appointments.some((item) => item.doctor === newApp.doctor && item.date === newApp.date && item.time === newApp.time);
    if (hasConflict) {
      const suggestion = suggestNextSlot(appointments, newApp.doctor, newApp.date);
      if (suggestion) {
        setToast({
          message: `Conflict detected for ${newApp.doctor} at ${newApp.time}. Suggested slot: ${suggestion.date} ${suggestion.time}.`,
          type: 'warning',
        });
      } else {
        setToast({ message: 'Conflict detected and no slot available in next 2 weeks.', type: 'error' });
      }
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setAppointments(prev => [...prev, { ...newApp, id: prev.length + 1 }]);
      setShowNewModal(false);
      setToast({ message: 'Appointment created! Notification sent to patient.', type: 'success' });
      setLoading(false);
    }, 800);
  };

  // Lấy danh sách bác sĩ và trạng thái duy nhất
  const doctorList = Array.from(new Set(appointments.map(a => a.doctor)));
  const statusList = Array.from(new Set(appointments.map(a => a.status)));

  const patientStatusSummary = useMemo(() => {
    const map = {};
    appointments.forEach((item) => {
      if (!map[item.patient]) {
        map[item.patient] = { total: 0, cancelled: 0, completed: 0, pending: 0 };
      }
      map[item.patient].total += 1;
      if (item.status === 'cancelled') map[item.patient].cancelled += 1;
      if (item.status === 'completed') map[item.patient].completed += 1;
      if (item.status === 'pending') map[item.patient].pending += 1;
    });
    return map;
  }, [appointments]);

  const smartQueueRecommendations = useMemo(() => {
    const candidates = appointments
      .filter((item) => item.status === 'pending' || item.status === 'cancelled')
      .map((item) => {
        const patientSummary = patientStatusSummary[item.patient] || { total: 1, cancelled: 0, completed: 0, pending: 0 };
        const cancelRate = Math.round((patientSummary.cancelled / Math.max(patientSummary.total, 1)) * 100);
        const doctorLoad = appointments.filter((row) => row.doctor === item.doctor && row.date === item.date).length;
        const priorityScore = Math.min(100, 35 + cancelRate * 0.5 + doctorLoad * 8 + (item.status === 'cancelled' ? 18 : 5));
        const recommendedSlot = suggestNextSlot(
          appointments,
          item.doctor,
          item.status === 'cancelled' ? addDaysIso(item.date, 1) : item.date
        );

        return {
          id: item.id,
          patient: item.patient,
          doctor: item.doctor,
          currentStatus: item.status,
          currentSlot: `${item.date} ${item.time}`,
          priorityScore: Math.round(priorityScore),
          recommendedSlot,
          queueAction: item.status === 'cancelled' ? 'Auto-rebook recommended' : 'Fast-track confirmation',
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return candidates.slice(0, 8);
  }, [appointments, patientStatusSummary]);

  const handleAutoRebookCancelled = useCallback(() => {
    let updatedCount = 0;

    setAppointments((prev) => prev.map((item) => {
      if (item.status !== 'cancelled') return item;
      const suggestion = suggestNextSlot(prev, item.doctor, addDaysIso(item.date, 1));
      if (!suggestion) return item;
      updatedCount += 1;
      return {
        ...item,
        date: suggestion.date,
        time: suggestion.time,
        status: 'pending',
        checkedIn: false,
      };
    }));

    if (updatedCount > 0) {
      setToast({ message: `Auto-rebooked ${updatedCount} cancelled appointment(s) into new pending slots.`, type: 'success' });
    } else {
      setToast({ message: 'No cancelled appointments eligible for auto-rebook.', type: 'warning' });
    }
  }, []);

  // Badge trạng thái
  const statusBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    let icon = '';
    if (normalized === 'pending') icon = '⏳';
    if (normalized === 'confirmed') icon = '✔️';
    if (normalized === 'completed') icon = '✅';
    if (normalized === 'cancelled') icon = '❌';
    if (normalized === 'checked-in') icon = '🟢';

    const statusClass = [
      'pending',
      'confirmed',
      'completed',
      'cancelled',
      'checked-in',
    ].includes(normalized)
      ? `ap-status-${normalized}`
      : 'ap-status-default';

    return (
      <span className={`ap-status-chip ${statusClass}`}>
        <span>{icon}</span> {status}
      </span>
    );
  };

  // Toast for upcoming appointments (mock: show if any appointment in next 2 hours)
  useEffect(() => {
    const now = new Date();
    const soon = appointments.find(a => {
      const dt = new Date(a.date + 'T' + a.time);
      return a.status === 'confirmed' && dt > now && dt - now < 2 * 60 * 60 * 1000;
    });
    if (soon) {
      setToast({ message: `Upcoming appointment: ${soon.patient} with ${soon.doctor} at ${soon.time}`, type: 'success' });
    }
  }, [appointments]);

  const runAppointmentsCommand = useCallback((action) => {
    if (!action) return;

    if (action === 'book') {
      setShowNewModal(true);
      return;
    }

    if (action === 'filter-pending') {
      setFilter((prev) => ({ ...prev, status: 'pending' }));
      return;
    }

    if (action === 'filter-today') {
      const today = new Date().toISOString().slice(0, 10);
      setFilter((prev) => ({ ...prev, date: today }));
      return;
    }

    if (action === 'clear-filters') {
      setFilter({ doctor: '', status: '', date: '', search: '' });
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

    if (action === 'jump-calendar') {
      calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-smart-queue') {
      smartQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'auto-rebook-cancelled') {
      handleAutoRebookCancelled();
    }
  }, [handleAutoRebookCancelled]);

  const runTopCommand = useCallback((rawValue) => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value) return;

    if (value.includes('new') && value.includes('appointment')) {
      setShowNewModal(true);
      return;
    }

    if (value.includes('new') && value.includes('patient')) {
      navigate(`/${ROUTES.PATIENTS}`);
      return;
    }

    if (value.includes('new') && value.includes('doctor')) {
      navigate(`/${ROUTES.DOCTORS}`);
      return;
    }

    if (value.includes('pending')) {
      setFilter((prev) => ({ ...prev, status: 'pending' }));
      return;
    }

    if (value.includes('today')) {
      const today = new Date().toISOString().slice(0, 10);
      setFilter((prev) => ({ ...prev, date: today }));
      return;
    }

    if (value.includes('calendar')) {
      calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (value.includes('queue')) {
      smartQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    window.dispatchEvent(new Event('command-palette:open'));
  }, [navigate]);

  useEffect(() => {
    const urlAction = new URLSearchParams(window.location.search).get('cp_action');
    if (urlAction) {
      runAppointmentsCommand(urlAction);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const onCommand = (event) => {
      const action = event?.detail?.action;
      runAppointmentsCommand(action);
    };

    window.addEventListener('appointments:command', onCommand);
    return () => window.removeEventListener('appointments:command', onCommand);
  }, [runAppointmentsCommand]);

  // ...existing code...
  // Biểu đồ tỷ lệ trạng thái (Pie chart)
  const pieData = (() => {
    const map = {};
    appointments.forEach(a => {
      map[a.status] = (map[a.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, value]) => ({ status, value }));
  })();
  const pieColors = ['var(--brand-500)', 'var(--warning-fg)', 'var(--success-fg)', 'var(--danger-fg)', '#0288d1'];

  // Lịch hẹn trong 2 giờ tới
  const now = new Date();
  const upcoming = appointments.filter(a => {
    if (a.status !== 'confirmed') return false;
    const dt = new Date(a.date + 'T' + a.time);
    return dt > now && dt - now < 2 * 60 * 60 * 1000;
  });

  // Tóm tắt bộ lọc
  const filterSummary = [];
  if (filter.search) filterSummary.push(`Search: ${filter.search}`);
  if (filter.date) filterSummary.push(`Date: ${filter.date}`);
  if (filter.doctor) filterSummary.push(`Doctor: ${filter.doctor}`);
  if (filter.status) filterSummary.push(`Status: ${filter.status}`);

  const renderRowActions = (item) => {
    const confirmAction = item.status === 'pending' ? (
      <button className="action-btn ap-btn-outline" title="Confirm" onClick={() => handleConfirm(item.id)}>
        <EditIcon />Confirm
      </button>
    ) : null;

    const checkinAction = item.status === 'confirmed' && !item.checkedIn ? (
      <button className="action-btn ap-btn-success" title="Check-in" onClick={() => handleCheckIn(item.id)}>
        <DeleteIcon />Check-in
      </button>
    ) : null;

    if (!isMobileViewport) {
      return (
        <div className="ap-actions-group ap-actions-inline">
          <button className="action-btn ap-btn-solid" title="Details" onClick={() => handleShowDetail(item)}>
            <DetailsIcon />Details
          </button>
          {confirmAction}
          {checkinAction}
        </div>
      );
    }

    const isOpen = mobileActionsRowId === item.id;
    return (
      <div className="ap-actions-dropdown">
        <button
          type="button"
          className="ap-actions-trigger"
          onClick={() => setMobileActionsRowId((prev) => (prev === item.id ? null : item.id))}
        >
          Actions {isOpen ? '\u25B2' : '\u25BC'}
        </button>
        {isOpen && (
          <div className="ap-actions-menu">
            <button className="action-btn ap-btn-solid" title="Details" onClick={() => { setMobileActionsRowId(null); handleShowDetail(item); }}>
              <DetailsIcon />Details
            </button>
            {item.status === 'pending' && (
              <button className="action-btn ap-btn-outline" title="Confirm" onClick={() => { setMobileActionsRowId(null); handleConfirm(item.id); }}>
                <EditIcon />Confirm
              </button>
            )}
            {item.status === 'confirmed' && !item.checkedIn && (
              <button className="action-btn ap-btn-success" title="Check-in" onClick={() => { setMobileActionsRowId(null); handleCheckIn(item.id); }}>
                <DeleteIcon />Check-in
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobileViewport(mobile);
      if (!mobile) {
        setMobileActionsRowId(null);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="page-content">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
          <h2 className="page-title">Appointments</h2>

          <section className="ap-command-bar ap-stagger ap-delay-1" aria-label="Global command bar for appointments">
            <div className="ap-command-bar-left">
              <p className="ap-command-label">Workspace Command Bar</p>
              <div className="ap-command-input-wrap">
                <input
                  type="text"
                  className="ap-command-input"
                  value={commandInput}
                  onChange={(event) => setCommandInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      runTopCommand(commandInput);
                      setCommandInput('');
                    }
                  }}
                  placeholder="Try: new appointment, new patient, pending today, open calendar"
                />
                <button
                  type="button"
                  className="ap-command-run"
                  onClick={() => {
                    runTopCommand(commandInput);
                    setCommandInput('');
                  }}
                >
                  Run
                </button>
              </div>
            </div>
            <div className="ap-command-actions">
              <button type="button" className="ap-command-chip" onClick={() => setShowNewModal(true)}>+ Appointment</button>
              <button type="button" className="ap-command-chip" onClick={() => navigate(`/${ROUTES.PATIENTS}`)}>+ Patient</button>
              <button type="button" className="ap-command-chip" onClick={() => navigate(`/${ROUTES.DOCTORS}`)}>+ Doctor</button>
              <button type="button" className="ap-command-chip" onClick={() => window.dispatchEvent(new Event('command-palette:open'))}>Command Palette</button>
            </div>
          </section>
          
          {/* Tóm tắt bộ lọc */}
          {filterSummary.length > 0 && (
            <div className="alert-box alert-info ap-filter-summary">
              {filterSummary.map((f,i) => <span key={i} className="ap-filter-pill">{f}</span>)}
            </div>
          )}
          {/* Lịch hẹn trong 2 giờ tới */}
          {upcoming.length > 0 && (
            <div className="alert-box alert-warning">
              <span className="ap-upcoming-icon">⏰</span>
              Upcoming appointments in next 2 hours:
              {upcoming.map((a,i) => (
                <span key={i} className="ap-upcoming-item">{a.patient} ({a.doctor}) at {a.time}</span>
              ))}
            </div>
          )}
          
          {/* Biểu đồ thống kê */}
          <div className="charts-row ap-stagger ap-delay-2">
            <div className="chart-card">
              <div className="chart-title">Appointments by Status (Stacked Bar)</div>
              <Suspense fallback={chartFallback}>
                <StackedBarStatusChart appointments={appointments} />
              </Suspense>
            </div>
            <div className="chart-card">
              <div className="chart-title">Appointment Status Ratio</div>
              <Suspense fallback={chartFallback}>
                <DonutChart
                  data={pieData.map(d => d.value)}
                  colors={pieColors}
                  labels={pieData.map(d => d.status)}
                />
              </Suspense>
            </div>
          </div>
          
          <div className="filter-row ap-stagger ap-delay-3">
            <button onClick={handleOpenNew} className="btn-primary">
              <EditIcon /> Book New Appointment
            </button>
            <button type="button" className="ap-density-toggle" onClick={() => setDenseTable((prev) => !prev)}>
              {denseTable ? 'Comfortable Table' : 'Compact Table'}
            </button>
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Quick search (name, doctor, ID)" 
              value={filter.search} 
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} 
              className="filter-input"
            />
            <input 
              type="date" 
              value={filter.date} 
              onChange={e => setFilter(f => ({ ...f, date: e.target.value }))} 
              className="filter-input"
            />
            <select 
              value={filter.doctor} 
              onChange={e => setFilter(f => ({ ...f, doctor: e.target.value }))} 
              className="filter-select"
            >
              <option value="">All Doctors</option>
              {doctorList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select 
              value={filter.status} 
              onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} 
              className="filter-select"
            >
              <option value="">All Status</option>
              {statusList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <section className="chart-card ap-smart-queue ap-stagger ap-delay-4" ref={smartQueueRef}>
            <div className="chart-title">Smart Queue Orchestrator</div>
            <p className="ap-smart-queue-note">
              Prioritizes pending/cancelled appointments by queue risk and recommends the next available slot for each doctor.
            </p>
            <div className="dashboard-action-row">
              <button onClick={handleAutoRebookCancelled} className="action-button action-primary">Auto-Rebook Cancelled</button>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Current Slot</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Recommended Slot</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {smartQueueRecommendations.length === 0 ? (
                    <tr>
                      <td colSpan={7}>No pending or cancelled appointments to optimize.</td>
                    </tr>
                  ) : smartQueueRecommendations.map((row) => (
                    <tr key={`sq-${row.id}`}>
                      <td>{row.patient}</td>
                      <td>{row.doctor}</td>
                      <td>{row.currentSlot}</td>
                      <td>{statusBadge(row.currentStatus)}</td>
                      <td>{row.priorityScore}</td>
                      <td>{row.recommendedSlot ? `${row.recommendedSlot.date} ${row.recommendedSlot.time}` : 'No slot'}</td>
                      <td>{row.queueAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          
          <div className={`table-wrapper ap-table-shell ap-stagger ap-delay-5 ${denseTable ? 'is-dense' : ''}`} ref={tableRef}>
            <table className="data-table ap-main-table">
              <thead>
                <tr>
                  <th className="ap-col-sticky-id">ID</th>
                  <th className="ap-col-sticky-patient">Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((item) => (
                  <tr key={item.id}>
                    <td className="ap-col-sticky-id">{item.id}</td>
                    <td className="ap-col-sticky-patient">{item.patient}</td>
                    <td>{item.doctor}</td>
                    <td>{item.date}</td>
                    <td>{item.time}</td>
                    <td>{statusBadge(item.status)}</td>
                    <td>{renderRowActions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Calendar */}
          <div className="chart-card ap-calendar-card ap-stagger ap-delay-6" ref={calendarRef}>
            <div className="chart-title">Appointment Calendar</div>
            <Suspense fallback={chartFallback}>
              <AppointmentCalendarChart appointments={appointments} />
            </Suspense>
          </div>
          <div className="appointments-features ap-features-layout ap-stagger ap-delay-7">
            <div className="appointments-feature-block ap-feature-card">
              <div className="appointments-feature-title ap-feature-title-strong">Quick Actions</div>
              <div className="appointments-feature-desc">
                <ul>
                  <li>Book a new appointment for any patient.</li>
                  <li>View and manage today’s schedule.</li>
                  <li>Filter appointments by doctor or status.</li>
                  <li>Check-in, confirm, and view details for each appointment.</li>
                </ul>
              </div>
            </div>
            <div className="appointments-feature-block ap-feature-card">
              <div className="appointments-feature-title ap-feature-title-strong">Appointment Tips</div>
              <div className="appointments-feature-desc">
                <ul>
                  <li>Click on a row to view appointment details.</li>
                  <li>Use the status color to quickly identify appointment state.</li>
                  <li>Keep patient and doctor info up to date for best results.</li>
                </ul>
              </div>
            </div>
          </div>
          {/* Modal đặt lịch mới (giả lập) */}
          {showNewModal && (
            <div className="ap-modal-overlay">
              <div className="ap-modal-card">
                <h3 className="ap-modal-title">Book New Appointment</h3>
                <NewAppointmentForm onSubmit={handleAddNew} onCancel={handleCloseNew} doctorList={doctorList} />
              </div>
            </div>
          )}
          {/* Modal xem chi tiết (giả lập) */}
          {showDetail && (
            <div className="ap-modal-overlay">
              <div className="ap-modal-card">
                <h3 className="ap-modal-title">Appointment Details</h3>
                <div><b>Patient:</b> {showDetail.patient}</div>
                <div><b>Doctor:</b> {showDetail.doctor}</div>
                <div><b>Date:</b> {showDetail.date}</div>
                <div><b>Time:</b> {showDetail.time}</div>
                <div><b>Status:</b> {showDetail.status}</div>
                <div className="ap-modal-footer">
                  <button onClick={handleCloseDetail} className="ap-close-btn">Close</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const addDaysIso = (isoDate, days) => {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

const suggestNextSlot = (appointments, doctor, startDate) => {
  const slots = [];
  for (let h = 8; h <= 17; h += 1) {
    for (const m of [0, 30]) {
      if (h === 17 && m > 0) continue;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const date = addDaysIso(startDate, dayOffset);
    for (const time of slots) {
      const isTaken = appointments.some((item) => item.doctor === doctor && item.date === date && item.time === time);
      if (!isTaken) {
        return { date, time };
      }
    }
  }

  return null;
};

// Form đặt lịch mới (giả lập)
function NewAppointmentForm({ onSubmit, onCancel, doctorList }) {
  const [form, setForm] = useState({ patient: '', doctor: doctorList[0] || '', date: '', time: '', status: 'pending', email: '', phone: '' });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <div className="ap-form-group">
        <input required placeholder="Patient Name" value={form.patient} onChange={e => setForm(f => ({ ...f, patient: e.target.value }))} className="ap-form-input ap-form-input-full" />
      </div>
      <div className="ap-form-group">
        <select required value={form.doctor} onChange={e => setForm(f => ({ ...f, doctor: e.target.value }))} className="ap-form-select ap-form-select-full">
          {doctorList.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="ap-form-row">
        <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="ap-form-input ap-form-flex" />
        <input required type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="ap-form-input ap-form-flex" />
      </div>
      <div className="ap-form-row">
        <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="ap-form-input ap-form-flex" />
        <input required placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="ap-form-input ap-form-flex" />
      </div>
      <div className="ap-form-group">
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="ap-form-select ap-form-select-full">
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>
      <div className="ap-form-actions">
        <button type="button" onClick={onCancel} className="ap-cancel-btn">Cancel</button>
        <button type="submit" className="ap-book-btn">Book</button>
      </div>
    </form>
  );
}
