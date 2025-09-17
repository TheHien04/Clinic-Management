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
  const data = doctors.map(d => ({ name: d.name, kpi: d.kpi?.month ?? 0 }));
  const max = Math.max(...data.map(d => d.kpi), 1);
  return (
    <div style={{margin:'18px auto 0',maxWidth:600,background:'#fff',borderRadius:10,boxShadow:'0 2px 8px #eee',padding:18}}>
      <div style={{fontWeight:600,marginBottom:10,color:'#1976d2',fontSize:'1.08rem'}}>KPI Comparison (This Month)</div>
      <div style={{display:'flex',alignItems:'flex-end',gap:10,height:90}}>
        {data.map((d) => (
          <div key={d.name} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
            <div style={{height:`${(d.kpi/max)*70}px`,width:18,background:'#1976d2',borderRadius:6,marginBottom:4,transition:'height 0.3s'}}></div>
            <div style={{fontSize:13,color:'#888'}}>{d.kpi}</div>
            <div style={{fontSize:11,color:'#aaa'}}>{d.name.replace('Dr. ','')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
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

function Doctors({ onNavigate, currentPage }) {
  
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
  const getHistory = (name) => appointments.filter(a => a.doctor === name);

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

  return (
    <div className="dashboard-layout" style={{width:'100vw', minHeight:'100vh', background:'#f7faff', display:'flex'}}>
      <Sidebar onNavigate={onNavigate} currentPage={currentPage || 'doctors'} />
      <div className="dashboard-main" style={{width:'100%', maxWidth:1400, margin:'0 auto', padding:'0 12px', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh'}}>
        <Header />
        <main className="doctors-content" style={{width:'100%', maxWidth:1200, margin:'0 auto', flex:1, overflowY:'auto', paddingBottom:32, background: 'transparent'}}>
          {loading && <Spinner />}
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
          <div style={{background: '#fff', borderRadius: 8, margin: '32px 0 16px 0', boxShadow: '0 2px 8px #e0e7ef', padding: 24}}>
            {/* Mini KPI Bar Chart */}
            <MiniKPIBarChart doctors={doctorList} />
            <h2 style={{fontWeight: 700, color: '#1976d2', marginBottom: 24, textAlign: 'center'}}>Doctors</h2>
            {/* Quick stats */}
            <div style={{display:'flex',gap:24,justifyContent:'center',marginBottom:18}}>
              <div style={{background:'#fff',borderRadius:10,padding:'12px 32px',boxShadow:'0 2px 8px #e0e7ef',fontWeight:600,color:'#1976d2'}}>Total: {stats.total}</div>
              <div style={{background:'#fff',borderRadius:10,padding:'12px 32px',boxShadow:'0 2px 8px #e0e7ef',fontWeight:600,color:'#43a047'}}>Active: {stats.active}</div>
              <div style={{background:'#fff',borderRadius:10,padding:'12px 32px',boxShadow:'0 2px 8px #e0e7ef',fontWeight:600,color:'#ffa000'}}>On Leave: {stats.onleave}</div>
              <div style={{background:'#fff',borderRadius:10,padding:'12px 32px',boxShadow:'0 2px 8px #e0e7ef',fontWeight:600,color:'#d32f2f'}}>Inactive: {stats.inactive}</div>
            </div>
            <div style={{display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap:'wrap'}}>
              <input type="text" placeholder="Search doctor name..." value={search} onChange={e => setSearch(e.target.value)} style={{flex: 1, padding: 8, borderRadius: 4, border: '1px solid #bfc9da', minWidth:120}} />
              <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)} style={{padding: 8, borderRadius: 4, border: '1px solid #bfc9da', minWidth: 160}}>
                <option value="">All Specialties</option>
                {specialtyList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{padding: 8, borderRadius: 4, border: '1px solid #bfc9da', minWidth: 120}}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="onleave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
              <input type="number" min="0" placeholder="Patients ≥..." value={patientCountFilter} onChange={e => setPatientCountFilter(e.target.value)} style={{padding:8,borderRadius:4,border:'1px solid #bfc9da',minWidth:80}} />
              <input type="number" min="0" placeholder="Appointments ≥..." value={appointmentCountFilter} onChange={e => setAppointmentCountFilter(e.target.value)} style={{padding:8,borderRadius:4,border:'1px solid #bfc9da',minWidth:80}} />
              <input type="number" min="0" placeholder="KPI ≥..." value={kpiFilter} onChange={e => setKpiFilter(e.target.value)} style={{padding:8,borderRadius:4,border:'1px solid #bfc9da',minWidth:80}} />
              <label style={{marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 15}}>
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive
              </label>
              <button style={{marginLeft: 8, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer'}} onClick={handleAdd}>Add Doctor</button>
            </div>
            <div style={{background: '#f6fafd', borderRadius: 6, boxShadow: '0 1px 4px #e0e7ef', padding: 0, marginBottom: 24, overflowX: 'auto'}}>
              <table className="doctors-table" style={{width: '100%', borderCollapse: 'collapse', minWidth: 700}}>
                <thead style={{background: '#e3efff'}}>
                  <tr>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>ID</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>Name</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>Specialty</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>Status</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>Patients</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>Appointments</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>KPI</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2',textAlign:'center'}}>Rating</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2',textAlign:'center'}}>Review</th>
                    <th style={{padding: 10, fontWeight: 700, color: '#1976d2'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const history = getHistory(d.name);
                    const patients = Array.from(new Set(history.map(h => h.patient)));
                    // Badge trạng thái
                    let statusBadge = null;
                    if (d.status === 'active') statusBadge = <span style={{background:'#43a047',color:'#fff',borderRadius:8,padding:'2px 8px',fontSize:12,fontWeight:700,marginLeft:6}}>Active</span>;
                    else if (d.status === 'onleave') statusBadge = <span style={{background:'#ffa000',color:'#fff',borderRadius:8,padding:'2px 8px',fontSize:12,fontWeight:700,marginLeft:6}}>On Leave</span>;
                    else if (d.status === 'inactive') statusBadge = <span style={{background:'#d32f2f',color:'#fff',borderRadius:8,padding:'2px 8px',fontSize:12,fontWeight:700,marginLeft:6}}>Inactive</span>;
                    return (
                      <tr key={d.id} style={{background: '#fff', borderBottom: '1px solid #e0e7ef'}}>
                        <td style={{padding: 10}}>{d.id}</td>
                        <td style={{padding: 10, display: 'flex', alignItems: 'center', gap: 8, cursor:'pointer',color:'#1976d2',fontWeight:600}} onClick={() => setModalDoctor({ ...d, history })}>
                          <AvatarIcon name={d.name} size={32} />
                          <span>{d.name}</span>
                        </td>
                        <td style={{padding: 10}}>{Array.isArray(d.specialty) ? d.specialty.join(', ') : d.specialty}</td>
                        <td style={{padding: 10}}>{statusBadge}</td>
                        <td style={{padding: 10}}>{patients.length}</td>
                        <td style={{padding: 10}}>{history.length}</td>
                        <td style={{padding: 10}}>{d.kpi?.month ?? 0}</td>
                        <td style={{padding: 10, textAlign:'center',color:'#1976d2',fontWeight:700,fontSize:17}}>
                          {d.kpi?.rating ? `${d.kpi.rating} ⭐` : '-'}
                        </td>
                        <td style={{padding: 10, textAlign:'center'}}>
                          <button title="View Reviews" style={{background:'#fff',color:'#fbc02d',border:'1.5px solid #fbc02d',borderRadius:6,padding:'4px 12px',fontWeight:600,cursor:'pointer',fontSize:15}} onClick={() => setModalDoctor({ ...d, history, showReviews: true })}>Reviews</button>
                        </td>
                        <td style={{padding: 10, display: 'flex', gap: 6}}>
                          <button title="View Details" style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => setModalDoctor({ ...d, history })}><DetailsIcon /></button>
                          <button title="Edit" style={{background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => handleEdit(d)}><EditIcon /></button>
                          <button title="Schedule" style={{background:'#43a047',color:'#fff',border:'none',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer'}} onClick={() => handleSchedule(d)}>Schedule</button>
                          <button title="Delete" style={{background:'#fff',color:'#d32f2f',border:'1.5px solid #d32f2f',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => handleDelete(d)}><DeleteIcon /></button>
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
            <div style={{display:'flex',gap:32,marginTop:32,justifyContent:'center',flexWrap:'wrap'}}>
              <div style={{background:'#fff',borderRadius:10,boxShadow:'0 2px 8px #e0e7ef',padding:18,minWidth:320,maxWidth:420,flex:1}}>
                <div style={{fontWeight:600,marginBottom:10,color:'#1976d2',fontSize:'1.08rem'}}>Doctor Overview (Radar Chart)</div>
                <DoctorRadarChart doctors={filtered.map(d => ({
                  name: d.name,
                  kpi: d.kpi,
                  patients: Array.from(new Set(appointments.filter(a => a.doctor === d.name).map(a => a.patient))),
                  appointments: appointments.filter(a => a.doctor === d.name).length
                }))} />
              </div>
              <div style={{background:'#fff',borderRadius:10,boxShadow:'0 2px 8px #e0e7ef',padding:18,minWidth:320,maxWidth:420,flex:1}}>
                <DoctorPieCharts doctors={filtered} />
              </div>
            </div>
          </div>
          <div style={{display: 'flex', gap: 24, marginTop: 24, flexWrap: 'wrap'}}>
            <div style={{flex: 1, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px #e0e7ef', padding: 24, minWidth: 260}}>
              <div style={{fontWeight: 700, color: '#1976d2', marginBottom: 8}}>Doctor Management</div>
              <ul style={{margin: 0, paddingLeft: 18, color: '#222'}}>
                <li>Centralized management of doctor profiles and schedules.</li>
                <li>View appointment and patient history for each doctor.</li>
                <li>Manage and assign work shifts (schedule) for each doctor.</li>
                <li>Filter by specialty, status, and KPI.</li>
                <li>Data privacy: Only authorized staff can view/edit doctor info.</li>
              </ul>
            </div>
            <div style={{flex: 1, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px #e0e7ef', padding: 24, minWidth: 260}}>
              <div style={{fontWeight: 700, color: '#1976d2', marginBottom: 8}}>Quick Actions</div>
              <ul style={{margin: 0, paddingLeft: 18, color: '#222'}}>
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
          <div><b>Schedule:</b> {doctor.schedule || '-'} <button style={{marginLeft:8,padding:'2px 8px',borderRadius:6,background:'#e3f2fd',color:'#1976d2',border:'none',fontWeight:600,cursor:'pointer'}} onClick={()=>setShowCalendar(true)}>View Calendar</button></div>
          <div><b>Status History:</b> {doctor.statusHistory?.join(' → ')}</div>
          <div><b>Reviews:</b> {doctor.reviews?.map((r,i)=>(<div key={i} style={{margin:'2px 0',color:'#888'}}>“{r}”</div>))}</div>
          <div style={{marginTop:12}}><b>Appointment History:</b></div>
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
