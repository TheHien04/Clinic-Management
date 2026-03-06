import React, { useState } from 'react';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Appointments.css';
import './Common.css';
import Spinner from '../components/Spinner';
import { Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import StackedBarStatusChart from '../components/StackedBarStatusChart';
import AppointmentCalendarChart from '../components/AppointmentCalendarChart';
import AppointmentSankeyChart from '../components/AppointmentSankeyChart';
import DonutChart from '../components/DonutChart';


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
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState({ doctor: '', status: '', date: '', search: '' });
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [loading, setLoading] = useState(false);

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
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Confirmed' } : a));
      setToast({ message: 'Appointment confirmed! Notification sent to patient.', type: 'success' });
      setLoading(false);
    }, 800);
  };

  // Handler: add new appointment (giả lập)
  const handleAddNew = (newApp) => {
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

  // Badge trạng thái
  const statusBadge = (status) => {
    let color = '#bdbdbd', bg = '#f5f5f5', icon = '';
    if (status === 'pending') { color = '#fbc02d'; bg = '#fffde7'; icon = '⏳'; }
    if (status === 'confirmed') { color = '#1976d2'; bg = '#e3f2fd'; icon = '✔️'; }
    if (status === 'completed') { color = '#43a047'; bg = '#e8f5e9'; icon = '✅'; }
    if (status === 'cancelled') { color = '#d32f2f'; bg = '#ffebee'; icon = '❌'; }
    if (status === 'checked-in') { color = '#0288d1'; bg = '#e1f5fe'; icon = '🟢'; }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color, background: bg, borderRadius: 8, padding: '2px 10px', fontSize: 13, border: `1.2px solid ${color}` }}>
        <span>{icon}</span> {status}
      </span>
    );
  };

  // Toast for upcoming appointments (mock: show if any appointment in next 2 hours)
  React.useEffect(() => {
    const now = new Date();
    const soon = appointments.find(a => {
      const dt = new Date(a.date + 'T' + a.time);
      return a.status === 'confirmed' && dt > now && dt - now < 2 * 60 * 60 * 1000;
    });
    if (soon) {
      setToast({ message: `Upcoming appointment: ${soon.patient} with ${soon.doctor} at ${soon.time}`, type: 'success' });
    }
  }, [appointments]);

  // ...existing code...
  // Biểu đồ tỷ lệ trạng thái (Pie chart)
  const pieData = (() => {
    const map = {};
    appointments.forEach(a => {
      map[a.status] = (map[a.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, value]) => ({ status, value }));
  })();
  const pieColors = ['#1976d2', '#fbc02d', '#43a047', '#d32f2f', '#0288d1'];

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

  if (loading) return <Spinner />;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="page-content">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
          <h2 className="page-title">Appointments</h2>
          
          {/* Tóm tắt bộ lọc */}
          {filterSummary.length > 0 && (
            <div className="alert-box alert-info" style={{marginBottom:10}}>
              {filterSummary.map((f,i) => <span key={i} style={{marginRight:12}}>{f}</span>)}
            </div>
          )}
          {/* Lịch hẹn trong 2 giờ tới */}
          {upcoming.length > 0 && (
            <div className="alert-box alert-warning">
              <span style={{fontSize:22}}>⏰</span>
              Upcoming appointments in next 2 hours:
              {upcoming.map((a,i) => (
                <span key={i} style={{marginLeft:18}}>{a.patient} ({a.doctor}) at {a.time}</span>
              ))}
            </div>
          )}
          
          {/* Biểu đồ thống kê */}
          <div className="charts-row">
            <div className="chart-card">
              <div className="chart-title">Appointments by Status (Stacked Bar)</div>
              <StackedBarStatusChart appointments={appointments} />
            </div>
            <div className="chart-card">
              <div className="chart-title">Appointment Status Ratio</div>
              <DonutChart
                data={pieData.map(d => d.value)}
                colors={pieColors}
                labels={pieData.map(d => d.status)}
              />
            </div>
          </div>
          
          <div className="filter-row">
            <button onClick={handleOpenNew} className="btn-primary">
              <EditIcon /> Book New Appointment
            </button>
            <input 
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
          
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
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
                    <td>{item.id}</td>
                    <td>{item.patient}</td>
                    <td>{item.doctor}</td>
                    <td>{item.date}</td>
                    <td>{item.time}</td>
                    <td>{statusBadge(item.status)}</td>
                    <td>
                      <button className="action-btn" title="Details" style={{background:'#1976d2',color:'#fff'}} onClick={() => handleShowDetail(item)}>
                        <DetailsIcon />Details
                      </button>
                      {item.status === 'pending' && (
                        <button className="action-btn" title="Confirm" style={{border:'1.5px solid #1976d2',color:'#1976d2'}} onClick={() => handleConfirm(item.id)}>
                          <EditIcon />Confirm
                        </button>
                      )}
                      {item.status === 'confirmed' && !item.checkedIn && (
                        <button className="action-btn" title="Check-in" style={{background:'#43a047',color:'#fff'}} onClick={() => handleCheckIn(item.id)}>
                          <DeleteIcon />Check-in
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Calendar */}
          <div className="chart-card" style={{width:'100%', maxWidth:1400, marginBottom:32}}>
            <div className="chart-title">Appointment Calendar</div>
            <AppointmentCalendarChart appointments={appointments} />
          </div>
          <div className="appointments-features" style={{width:'100%', maxWidth:1400, display:'flex', gap:32, flexWrap:'wrap', marginBottom:32}}>
            <div className="appointments-feature-block" style={{flex:1, minWidth:300, background:'#fff', border:'1px solid #e3eaf3', borderRadius:10, boxShadow:'0 2px 8px #e0e7ef', padding:24}}>
              <div className="appointments-feature-title" style={{fontWeight:700, fontSize:16, color:'#1976d2', marginBottom:12}}>Quick Actions</div>
              <div className="appointments-feature-desc">
                <ul style={{paddingLeft: 18, margin: 0}}>
                  <li>Book a new appointment for any patient.</li>
                  <li>View and manage today’s schedule.</li>
                  <li>Filter appointments by doctor or status.</li>
                  <li>Check-in, confirm, and view details for each appointment.</li>
                </ul>
              </div>
            </div>
            <div className="appointments-feature-block" style={{flex:1, minWidth:300, background:'#fff', border:'1px solid #e3eaf3', borderRadius:10, boxShadow:'0 2px 8px #e0e7ef', padding:24}}>
              <div className="appointments-feature-title" style={{fontWeight:700, fontSize:16, color:'#1976d2', marginBottom:12}}>Appointment Tips</div>
              <div className="appointments-feature-desc">
                <ul style={{paddingLeft: 18, margin: 0}}>
                  <li>Click on a row to view appointment details.</li>
                  <li>Use the status color to quickly identify appointment state.</li>
                  <li>Keep patient and doctor info up to date for best results.</li>
                </ul>
              </div>
            </div>
          </div>
          {/* Modal đặt lịch mới (giả lập) */}
          {showNewModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY:'auto' }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 32, minWidth: 320, minHeight: 200, maxHeight:'90vh', overflowY:'auto', boxShadow: '0 2px 16px rgba(25,118,210,0.13)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <h3 style={{ color: '#1976d2', marginBottom: 18 }}>Book New Appointment</h3>
                <NewAppointmentForm onSubmit={handleAddNew} onCancel={handleCloseNew} doctorList={doctorList} />
              </div>
            </div>
          )}
          {/* Modal xem chi tiết (giả lập) */}
          {showDetail && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY:'auto' }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 32, minWidth: 320, minHeight: 200, maxHeight:'90vh', overflowY:'auto', boxShadow: '0 2px 16px rgba(25,118,210,0.13)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <h3 style={{ color: '#1976d2', marginBottom: 18 }}>Appointment Details</h3>
                <div><b>Patient:</b> {showDetail.patient}</div>
                <div><b>Doctor:</b> {showDetail.doctor}</div>
                <div><b>Date:</b> {showDetail.date}</div>
                <div><b>Time:</b> {showDetail.time}</div>
                <div><b>Status:</b> {showDetail.status}</div>
                <div style={{ marginTop: 18 }}>
                  <button onClick={handleCloseDetail} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Form đặt lịch mới (giả lập)
function NewAppointmentForm({ onSubmit, onCancel, doctorList }) {
  const [form, setForm] = useState({ patient: '', doctor: doctorList[0] || '', date: '', time: '', status: 'Pending', email: '', phone: '' });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <div style={{ marginBottom: 12 }}>
        <input required placeholder="Patient Name" value={form.patient} onChange={e => setForm(f => ({ ...f, patient: e.target.value }))} style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #b0bec5' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <select required value={form.doctor} onChange={e => setForm(f => ({ ...f, doctor: e.target.value }))} style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #b0bec5' }}>
          {doctorList.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ padding: 8, borderRadius: 4, border: '1px solid #b0bec5', flex: 1 }} />
        <input required type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ padding: 8, borderRadius: 4, border: '1px solid #b0bec5', flex: 1 }} />
      </div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ padding: 8, borderRadius: 4, border: '1px solid #b0bec5', flex: 1 }} />
        <input required placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ padding: 8, borderRadius: 4, border: '1px solid #b0bec5', flex: 1 }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #b0bec5' }}>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button type="submit" style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>Book</button>
      </div>
    </form>
  );
}
