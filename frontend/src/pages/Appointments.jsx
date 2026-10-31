import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Common.css';
import './Appointments.css';
import Spinner from '../components/Spinner';
import { ROUTES } from '../constants';

const AppointmentCalendarChart = lazy(() => import('../components/AppointmentCalendarChart'));


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
  const [selectedIds, setSelectedIds] = useState([]);
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
        <span className="ap-status-dot" aria-hidden="true" /> {status}
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

  const selectedRows = appointments.filter((item) => selectedIds.includes(item.id));
  const allFilteredSelected = filteredAppointments.length > 0 && filteredAppointments.every((item) => selectedIds.includes(item.id));
  const toggleAppointmentSelection = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  const toggleAllFiltered = () => setSelectedIds((current) => allFilteredSelected
    ? current.filter((id) => !filteredAppointments.some((item) => item.id === id))
    : [...new Set([...current, ...filteredAppointments.map((item) => item.id)])]);
  const handleBulkStatus = (mode) => {
    const eligibleIds = selectedRows
      .filter((item) => mode === 'confirm' ? item.status === 'pending' : item.status === 'confirmed' && !item.checkedIn)
      .map((item) => item.id);
    if (!eligibleIds.length) {
      setToast({ message: `No selected appointments are eligible to ${mode}.`, type: 'warning' });
      return;
    }
    setAppointments((current) => current.map((item) => eligibleIds.includes(item.id)
      ? { ...item, status: mode === 'confirm' ? 'confirmed' : 'checked-in', checkedIn: mode === 'check-in' ? true : item.checkedIn }
      : item));
    setSelectedIds([]);
    setToast({ message: `${eligibleIds.length} appointment(s) updated successfully.`, type: 'success' });
  };

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
        <main id="main-content" tabIndex="-1" className="page-content">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
          <section className="ap-hero" aria-labelledby="appointments-title">
            <div className="ap-hero-main">
              <p className="ap-hero-kicker"><span /> Patient flow / live</p>
              <h1 id="appointments-title">Flow, not <em>friction.</em></h1>
              <p>Coordinate arrivals, clinical time and follow-up from one precise care timeline.</p>
              <button type="button" onClick={handleOpenNew}>Book a new appointment <span>↗</span></button>
            </div>
            <div className="ap-hero-visual">
              <img src="/images/patient-consultation.jpg" alt="Clinician consulting with a patient" />
              <div className="ap-hero-stat ap-stat-a"><small>Total flow</small><strong>{appointments.length}</strong><span>appointments</span></div>
              <div className="ap-hero-stat ap-stat-b"><small>Confirmed</small><strong>{appointments.filter((item) => item.status === 'confirmed').length}</strong><span>ready for care</span></div>
            </div>
            <div className="ap-hero-side">
              <span>Today’s signal</span>
              <strong>{appointments.filter((item) => item.status === 'pending').length}</strong>
              <p>appointments need confirmation</p>
              <button type="button" onClick={() => setFilter((current) => ({ ...current, status: 'pending' }))}>Review queue →</button>
            </div>
          </section>

          <div className="ap-section-intro"><span>01 / Orchestration</span><h2>Appointment command</h2><p>Move from request to care without losing context.</p></div>

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
          
          <section className="ap-flow-desk ap-stagger ap-delay-2" aria-labelledby="ap-flow-title">
            <div className="ap-flow-head"><div><span>Live care lanes</span><h3 id="ap-flow-title">Move each appointment to the next action</h3></div><small>{appointments.length} appointments in scope</small></div>
            <div className="ap-flow-lanes">
              {[
                ['pending', 'Review requests', 'Verify details and reserve clinical time'],
                ['confirmed', 'Prepare arrival', 'Patient is ready for check-in'],
                ['checked-in', 'Route to care', 'Patient is waiting for the clinician'],
                ['completed', 'Close the loop', 'Record outcome and follow-up'],
                ['cancelled', 'Recover capacity', 'Offer the next appropriate slot'],
              ].map(([status, label, description], index) => {
                const count = appointments.filter((item) => item.status === status).length;
                return (
                  <button key={status} type="button" className={`ap-flow-lane is-${status}`} onClick={() => {
                    setFilter((current) => ({ ...current, status }));
                    window.setTimeout(() => tableRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 80);
                  }}>
                    <span className="ap-flow-index">0{index + 1}</span><span><b>{label}</b><small>{description}</small></span><strong>{count}</strong>
                  </button>
                );
              })}
            </div>
            <div className="ap-flow-next">
              <div><span>Next operational move</span><b>{smartQueueRecommendations[0]?.patient || 'Queue is clear'}</b><small>{smartQueueRecommendations[0] ? `${smartQueueRecommendations[0].action} · ${smartQueueRecommendations[0].recommendedSlot}` : 'No pending or cancelled appointment needs recovery.'}</small></div>
              <button type="button" onClick={() => smartQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Open smart queue →</button>
            </div>
          </section>
          
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

          {selectedIds.length > 0 && (
            <div className="ap-bulk-bar" role="region" aria-label="Bulk appointment actions">
              <div><strong>{selectedIds.length}</strong><span>appointments selected</span></div>
              <p>{selectedRows.filter((item) => item.status === 'pending').length} pending · {selectedRows.filter((item) => item.status === 'confirmed').length} ready for check-in</p>
              <div><button type="button" onClick={() => handleBulkStatus('confirm')}>Confirm pending</button><button type="button" onClick={() => handleBulkStatus('check-in')}>Check in ready</button><button type="button" onClick={() => setSelectedIds([])}>Clear</button></div>
            </div>
          )}
          
          <div className={`table-wrapper ap-table-shell ap-stagger ap-delay-5 ${denseTable ? 'is-dense' : ''}`} ref={tableRef}>
            <table className="data-table ap-main-table">
              <thead>
                <tr>
                  <th className="ap-select-col"><input type="checkbox" aria-label="Select all filtered appointments" checked={allFilteredSelected} onChange={toggleAllFiltered} /></th>
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
                  <tr key={item.id} className={selectedIds.includes(item.id) ? 'is-selected' : ''}>
                    <td className="ap-select-col"><input type="checkbox" aria-label={`Select appointment ${item.id}`} checked={selectedIds.includes(item.id)} onChange={() => toggleAppointmentSelection(item.id)} /></td>
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
