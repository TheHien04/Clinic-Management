import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import PatientModal from '../components/PatientModal';
import PatientForm from '../components/PatientForm';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Patients.css';

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

export default function Patients({ onNavigate, currentPage }) {
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

  // Lấy danh sách bệnh nhân duy nhất từ appointments và patients
  // Mock: enrich patients with more info
  // Mock: enrich patients with more info (chronic, email, phone)
  // Mock base data and appointments for all pages (April, June, August)
  const base = [
    { id: 1, name: 'Nguyen Van A', email: 'vana@gmail.com', phone: '0901234567', warning: 'Chronic: Diabetes', dob: '1980-05-12' },
    { id: 2, name: 'Tran Thi B', email: 'thib@gmail.com', phone: '0902345678', warning: '', dob: '2005-09-20' },
    { id: 3, name: 'Le Van C', email: 'vanc@gmail.com', phone: '0903456789', warning: 'Chronic: Hypertension', dob: '1950-03-01' },
    { id: 4, name: 'Pham Thi D', email: 'thid@gmail.com', phone: '0904567890', warning: '', dob: '1995-12-15' },
    { id: 5, name: 'Hoang Minh G', email: 'minhg@gmail.com', phone: '0905678912', warning: 'Chronic: Asthma', dob: '2010-07-22' },
    { id: 6, name: 'Nguyen Thi H', email: 'thih@gmail.com', phone: '0906789123', warning: '', dob: '1972-11-03' },
  ];
  // Use mockAppointments for all pages
  const patientList = useMemo(() => {
    const all = [...base];
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
  }, [base]);
  // Use mockAppointments for chart and filters
  const appointments = mockAppointments;

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
  const pieColors = ['#4db6ac', '#ffb74d', '#64b5f6'];

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
    <div className="dashboard-layout" style={{width:'100vw', minHeight:'100vh', background:'#f7faff', display:'flex'}}>
      <Sidebar onNavigate={onNavigate} currentPage={currentPage || 'patients'} />
      <div className="dashboard-main" style={{width:'100%', maxWidth:1400, margin:'0 auto', padding:'0 12px', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh'}}>
        <Header />
        <main className="patients-content" style={{width:'100%', maxWidth:1200, margin:'0 auto', flex:1, overflowY:'auto', paddingBottom:32}}>
          <h2>Patients</h2>
          {/* Top section: stats/pie chart and patient growth chart side by side, then new patients box below */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0,marginBottom:24}}>
            <div style={{display:'flex',flexDirection:'row',gap:16,alignItems:'stretch',justifyContent:'center',width:'100%',marginBottom:8}}>
              <div style={{background:'rgba(245,250,255,0.8)',borderRadius:20,padding:'22px 38px',boxShadow:'0 2px 8px #e0e7ef',display:'flex',gap:32,alignItems:'center',minWidth:420,width:'48%',height:260}}>
                <div style={{fontWeight:700,fontSize:20,color:'#1976d2',textAlign:'center'}}>Total<br/><span style={{fontSize:28,color:'#1976d2'}}>{stats.total}</span></div>
                <div style={{fontWeight:700,fontSize:20,color:'#4db6ac',textAlign:'center'}}>Chronic<br/><span style={{fontSize:28,color:'#4db6ac'}}>{stats.chronic}</span></div>
                <div style={{fontWeight:700,fontSize:20,color:'#ffb74d',textAlign:'center'}}>New<br/><span style={{fontSize:28,color:'#ffb74d'}}>{stats.newThisMonth}</span></div>
                <div style={{width:140,height:140,position:'relative'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart style={{filter:'drop-shadow(0 2px 8px #e0e7ef)'}}>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={55} paddingAngle={2} >
                        {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={pieColors[idx]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend dưới pie chart */}
                  <div style={{position:'absolute',bottom:-18,left:'50%',transform:'translateX(-50%)',display:'flex',gap:10,fontSize:12}}>
                    <span style={{color:'#4db6ac'}}>&#9679; Chronic</span>
                    <span style={{color:'#ffb74d'}}>&#9679; New</span>
                    <span style={{color:'#64b5f6'}}>&#9679; Other</span>
                  </div>
                </div>
              </div>
              {/* Patient Growth by Month chart to the right, same height */}
              <div style={{background:'#fff',borderRadius:18,padding:'22px 38px',boxShadow:'0 2px 8px #e0e7ef',minWidth:420,width:'48%',height:260,display:'flex',flexDirection:'column',justifyContent:'center'}}>
                <div style={{fontWeight:700,fontSize:18,color:'#1976d2',marginBottom:8,textAlign:'center'}}>Patient Growth by Month</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={patientGrowthData} margin={{top:8,right:16,left:0,bottom:8}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{fontSize:13}} />
                    <YAxis allowDecimals={false} tick={{fontSize:13}} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1976d2" radius={[8,8,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* New Patients This Month box - prominent, colored, with icon */}
            <div style={{background:'#fff',borderRadius:18,padding:'16px 40px',boxShadow:'0 4px 16px #b3c6ff',fontWeight:800,fontSize:26,color:'#1976d2',textAlign:'center',letterSpacing:1,minWidth:280,margin:'18px 0 0 0',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <span style={{fontSize:20,color:'#1976d2',fontWeight:700,marginBottom:2,display:'flex',alignItems:'center',gap:8}}>
                <span role="img" aria-label="new-patient" style={{fontSize:26}}>👤</span>
                New Patients This Month
              </span>
              <span style={{fontSize:40,color:'#4db6ac',fontWeight:900,lineHeight:1,background:'#f5fafd',borderRadius:10,padding:'2px 18px',marginTop:6,boxShadow:'0 2px 8px #e0e7ef'}}>{stats.newThisMonth}</span>
            </div>
          </div>
          <div className="patients-search-row" style={{display:'flex',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
            {/* Filter summary/info block to fill whitespace */}
            <div style={{minWidth:170,maxWidth:210,background:'linear-gradient(90deg,#e3efff 70%,#fff 100%)',borderRadius:14,padding:'10px 18px',fontWeight:600,color:'#1976d2',boxShadow:'0 2px 8px #e0e7ef',marginRight:10,display:'flex',flexDirection:'row',alignItems:'center',gap:10}}>
              <span role="img" aria-label="filter" style={{fontSize:20,marginRight:4}}>🔎</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center'}}>
                <div style={{fontSize:15,marginBottom:2,fontWeight:700}}>Filters</div>
                <div style={{fontSize:13,fontWeight:400,minHeight:18}}>
                  {search && <span>Name: <b>{search}</b> </span>}
                  {emailFilter && <span>Email: <b>{emailFilter}</b> </span>}
                  {phoneFilter && <span>Phone: <b>{phoneFilter}</b> </span>}
                  {idFilter && <span>ID: <b>{idFilter}</b> </span>}
                  {lastVisitFilter && <span>Last Visit: <b>{lastVisitFilter}</b> </span>}
                  {visitCountFilter && <span>Visits ≥ <b>{visitCountFilter}</b> </span>}
                  {doctorFilter && <span>Doctor: <b>{doctorFilter}</b> </span>}
                  {chronicFilter && <span>Chronic only </span>}
                  {(!search && !doctorFilter && !chronicFilter && !emailFilter && !phoneFilter && !idFilter && !lastVisitFilter && !visitCountFilter) && <span style={{color:'#888'}}>No filters applied, showing all patients.</span>}
                </div>
              </div>
            </div>
            {/* ...existing code... */}
            <input type="text" placeholder="Name..." value={search} onChange={e => setSearch(e.target.value)} className="patients-search-input" style={{minWidth:120}} />
            <input type="text" placeholder="Email..." value={emailFilter} onChange={e => setEmailFilter(e.target.value)} className="patients-search-input" style={{minWidth:120}} />
            <input type="text" placeholder="Phone..." value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)} className="patients-search-input" style={{minWidth:100}} />
            <input type="text" placeholder="ID..." value={idFilter} onChange={e => setIdFilter(e.target.value)} className="patients-search-input" style={{minWidth:60}} />
            <input type="date" placeholder="Last Visit..." value={lastVisitFilter} onChange={e => setLastVisitFilter(e.target.value)} className="patients-search-input" style={{minWidth:120}} />
            <input type="number" min="1" placeholder="Visits ≥..." value={visitCountFilter} onChange={e => setVisitCountFilter(e.target.value)} className="patients-search-input" style={{minWidth:80}} />
            <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="patients-search-input" style={{minWidth:120}}>
              <option value="">All Doctors</option>
              {doctorList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label style={{marginLeft:8,display:'flex',alignItems:'center',gap:4,fontSize:15}}>
              <input type="checkbox" checked={chronicFilter} onChange={e => setChronicFilter(e.target.checked)} /> Chronic only
            </label>
            <button style={{marginLeft:8,background:'#1976d2',color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:700,fontSize:16,boxShadow:'0 2px 8px #e0e7ef',cursor:'pointer',display:'flex',alignItems:'center',gap:8}} onClick={handleAdd}><EditIcon /> Add Patient</button>
          </div>
          <div className="patients-table-wrapper" style={{background:'#fff',borderRadius:10,boxShadow:'0 2px 8px #e0e7ef',padding:'0 0 12px 0',marginBottom:24,overflowX:'auto'}}>
            <table className="patients-table" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
              <thead style={{background:'#e3efff'}}>
                <tr>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>ID</th>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>Name</th>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>Email</th>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>Phone</th>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>Visits</th>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>Last Visit</th>
                  <th style={{padding:10,fontWeight:700,color:'#1976d2'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecent.map((p) => {
                  const history = getHistory(p.name);
                  const lastVisit = history.length ? history[history.length - 1].date : '-';
                  // Badge logic
                  let badge = null;
                  if (p.warning && p.warning.toLowerCase().includes('chronic')) badge = <span style={{background:'#fbc02d',color:'#fff',borderRadius:8,padding:'2px 8px',fontSize:12,fontWeight:700,marginLeft:6}}>Chronic</span>;
                  else if (p.dob) {
                    const age = Math.floor((new Date().getTime() - new Date(p.dob).getTime())/3.15576e10);
                    if (age < 16) badge = <span style={{background:'#1976d2',color:'#fff',borderRadius:8,padding:'2px 8px',fontSize:12,fontWeight:700,marginLeft:6}}>Child</span>;
                    else if (age > 65) badge = <span style={{background:'#d32f2f',color:'#fff',borderRadius:8,padding:'2px 8px',fontSize:12,fontWeight:700,marginLeft:6}}>Elderly</span>;
                  }
                  return (
                    <tr key={p.id} style={{background:'#fff',borderBottom:'1px solid #e0e7ef'}}>
                      <td style={{padding:10}}>{p.id}</td>
                      <td style={{padding:10,cursor:'pointer',color:'#1976d2',fontWeight:600}} onClick={() => handleView(p)}>{p.name} {badge}</td>
                      <td style={{padding:10}}>{p.email}</td>
                      <td style={{padding:10}}>{p.phone}</td>
                      <td style={{padding:10}}>{history.length}</td>
                      <td style={{padding:10}}>{lastVisit}</td>
                      <td style={{padding:10,display:'flex',gap:6}}>
                        <button title="View Record" style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => handleView(p)}><DetailsIcon />View</button>
                        {history.length > 0 && (
                          <button title="Download PDF" style={{background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => handleDownload(p)}><EditIcon />PDF</button>
                        )}
                        <button title="Edit" style={{background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => handleEdit(p)}><EditIcon />Edit</button>
                        <button title="Delete" style={{background:'#fff',color:'#d32f2f',border:'1.5px solid #d32f2f',borderRadius:4,padding:'6px 10px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={() => handleDelete(p)}><DeleteIcon />Delete</button>
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
