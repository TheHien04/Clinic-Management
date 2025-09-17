


import React, { useMemo } from 'react';
import { FaCalendarAlt, FaUserMd, FaUser, FaChartBar } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Dashboard.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
// Pie chart colors
const pieColors = ['#1976d2', '#fbc02d', '#43a047', '#d32f2f', '#0288d1'];

// PieChart tỷ lệ trạng thái appointments
function StatusPieChart({ data }) {
  return (
  <div style={{ marginTop: '24px', width: '50%', minWidth: 380, maxWidth: 600, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee', border: '1px solid #e3eaf3', padding: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: '#1976d2', fontSize: '1.08rem' }}>Appointment Status Ratio</div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {data.map((entry, idx) => <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div style={{display:'flex',gap:12,marginTop:8,justifyContent:'center',flexWrap:'wrap'}}>
        {data.map((d,idx) => (
          <span key={d.name} style={{display:'flex',alignItems:'center',gap:4,fontSize:13}}>
            <span style={{width:14,height:14,background:pieColors[idx%pieColors.length],borderRadius:3,display:'inline-block'}}></span>
            {d.name}: <b>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// Top bác sĩ nhiều lịch hẹn nhất tuần
function TopDoctors({ appointments }) {
  // Đếm số lịch hẹn theo bác sĩ
  const doctorCount = {};
  appointments.forEach(a => {
    doctorCount[a.doctor] = (doctorCount[a.doctor] || 0) + 1;
  });
  const top = Object.entries(doctorCount).sort((a,b) => b[1]-a[1]).slice(0,3);
  return (
  <div style={{ marginTop: '24px', width: '50%', minWidth: 380, maxWidth: 600, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee', border: '1px solid #e3eaf3', padding: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: '#1976d2', fontSize: '1.08rem' }}>Top Doctors (Most Appointments)</div>
      <ul style={{margin:0,padding:0,listStyle:'none'}}>
        {top.map(([name,count],idx) => (
          <li key={name} style={{fontWeight:600,fontSize:15,marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:'#e3f2fd',color:'#1976d2',borderRadius:6,padding:'2px 10px',fontWeight:700}}>{idx+1}</span>
            {name} <span style={{color:'#888',fontWeight:400}}>({count} appointments)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Widget Recent Activities
function RecentActivities({ activities }) {
  return (
  <div style={{ marginTop: '24px', width: '50%', minWidth: 380, maxWidth: 600, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee', border: '1px solid #e3eaf3', padding: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: '#1976d2', fontSize: '1.08rem' }}>Recent Activities</div>
      <ul style={{margin:0,padding:0,listStyle:'none'}}>
        {activities.length === 0 ? <li style={{color:'#888'}}>No recent activities.</li> : activities.map((act,idx) => (
          <li key={idx} style={{fontSize:14,marginBottom:8,color:'#333'}}>{act}</li>
        ))}
      </ul>
    </div>
  );
}


// Biểu đồ KPI sử dụng recharts
function KPIBarChart({ data }) {
  return (
  <div style={{ marginTop: '24px', width: '50%', minWidth: 380, maxWidth: 600, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee', border: '1px solid #e3eaf3', padding: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: '#1976d2', fontSize: '1.08rem' }}>Appointments in Last 7 Days</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={d => d.slice(5)} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#1976d2" name="Appointments" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard({ onNavigate, currentPage, onLogout }) {
  // Mock data KPI (có thể lấy từ props hoặc context thực tế)
  const today = '2025-08-29';
  const { appointments, patients, doctors, kpi } = useMemo(() => {
    const appointments = [
      { id: 1, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'Confirmed' },
      { id: 2, patient: 'Tran Thi B', doctor: 'Dr. John', date: '2025-08-29', time: '10:00', status: 'Pending' },
      { id: 3, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-29', time: '11:00', status: 'Completed' },
      { id: 4, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-29', time: '13:00', status: 'Completed' },
      { id: 5, patient: 'Nguyen Van A', doctor: 'Dr. Smith', date: '2025-08-29', time: '09:00', status: 'Confirmed' }, // duplicate for conflict
      { id: 6, patient: 'Nguyen Van B', doctor: 'Dr. John', date: '2025-08-29', time: '15:00', status: 'Pending' },
      { id: 7, patient: 'Le Van C', doctor: 'Dr. Smith', date: '2025-08-28', time: '08:30', status: 'Completed' },
      { id: 8, patient: 'Pham Thi D', doctor: 'Dr. Anna', date: '2025-08-28', time: '11:00', status: 'Cancelled' },
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
    const todayApps = appointments.filter(a => a.date === today);
    const waiting = todayApps.filter(a => a.status === 'Pending').length;
    const confirmed = todayApps.filter(a => a.status === 'Confirmed').length;
    const completed = todayApps.filter(a => a.status === 'Completed').length;
    // Cảnh báo quá tải: >3 ca cùng bác sĩ cùng khung giờ
    let overload = false, conflict = false;
    const byDoctorTime = {};
    todayApps.forEach(a => {
      const key = a.doctor + '-' + a.time;
      byDoctorTime[key] = (byDoctorTime[key] || 0) + 1;
      if (byDoctorTime[key] > 1) conflict = true;
      if (byDoctorTime[key] > 3) overload = true;
    });
    const kpi = {
      today: todayApps.length,
      waiting,
      confirmed,
      completed,
      overload,
      conflict,
    };
    return { appointments, patients, doctors, kpi };
  }, [today]);

  // Pie chart data trạng thái
  const statusPieData = useMemo(() => {
    const statusCount = {};
    appointments.forEach(a => {
      statusCount[a.status] = (statusCount[a.status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([name,value]) => ({ name, value }));
  }, [appointments]);

  // Recent activities (mock)
  const recentActivities = [
    'Confirmed appointment for Nguyen Van A with Dr. Smith.',
    'Added new patient: Tran Thi B.',
    'Completed appointment for Le Van C.',
    'Doctor Anna updated her schedule.',
    'Cancelled appointment for Pham Thi D.'
  ];

  // Prepare data for mini KPI bar chart (appointments last 7 days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date(new Date(today).getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    return { date: dateStr };
  });
  const barChartData = last7Days.map(d => ({
    date: d.date,
    count: (patients && doctors) ? ( // use mock data
      [
        { id: 1, date: '2025-08-23' },
        { id: 2, date: '2025-08-24' },
        { id: 3, date: '2025-08-25' },
        { id: 4, date: '2025-08-26' },
        { id: 5, date: '2025-08-27' },
        { id: 6, date: '2025-08-28' },
        { id: 7, date: '2025-08-29' },
      ].find(x => x.date === d.date) ? Math.floor(Math.random() * 6 + 2) : 0
    ) : 0
  }));

  // Shortcut handler
  const handleShortcut = (key) => {
    if (onNavigate) {
      if (key === 'book') onNavigate('appointments');
      if (key === 'schedule') onNavigate('appointments');
      if (key === 'kpi') onNavigate('reports');
    }
  };

  return (
    <div className="dashboard-layout" style={{width:'100vw', minHeight:'100vh', background:'#f7faff', display:'flex'}}>
      <Sidebar onNavigate={onNavigate} currentPage={currentPage || 'dashboard'} />
      <div className="dashboard-main" style={{width:'100%', maxWidth:1400, margin:'0 auto', padding:'0 12px', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh'}}>
        <Header onLogout={onLogout} />
        <main className="dashboard-content" style={{width:'100%', maxWidth:1200, margin:'0 auto', flex:1, overflowY:'auto', paddingBottom:32}}>
          <h2 style={{marginBottom: 32, color: '#1976d2', fontWeight: 700}}>Welcome to Clinic Management Dashboard</h2>
          {/* KPI tổng hợp */}
          <div className="dashboard-stats-row" style={{width:'100%', maxWidth:1200, margin:'0 auto 18px auto', display:'flex', justifyContent:'center', gap:24}}>
            {/* KPI cards style giống Quick Links */}
            <div style={{background:'#fff',borderRadius:12,boxShadow:'0 2px 8px #eee',border:'1px solid #e3eaf3',padding:24,display:'flex',flex:1,justifyContent:'space-between',gap:24}}>
              <div className="stat-card">
              <div className="stat-title" style={{display:'flex',alignItems:'center',gap:8}}><FaCalendarAlt style={{color:'#1976d2'}}/>Today's Appointments</div>
              <div className="stat-value">{kpi.today}</div>
            </div>
              <div className="stat-card">
              <div className="stat-title" style={{display:'flex',alignItems:'center',gap:8}}><FaUser style={{color:'#fbc02d'}}/>Waiting</div>
              <div className="stat-value">{kpi.waiting}</div>
            </div>
              <div className="stat-card">
              <div className="stat-title" style={{display:'flex',alignItems:'center',gap:8}}><FaChartBar style={{color:'#43a047'}}/>Completed</div>
              <div className="stat-value">{kpi.completed}</div>
            </div>
              <div className="stat-card">
              <div className="stat-title" style={{display:'flex',alignItems:'center',gap:8}}><FaUserMd style={{color:'#1976d2'}}/>Doctors</div>
              <div className="stat-value">{doctors.length}</div>
            </div>
              <div className="stat-card">
              <div className="stat-title" style={{display:'flex',alignItems:'center',gap:8}}><FaUser style={{color:'#1976d2'}}/>Patients</div>
              <div className="stat-value">{patients.length}</div>
            </div>
            </div>
          </div>
    {/* KPI Bar Chart + Pie Chart: side by side */}
  <div style={{display:'flex',gap:0,justifyContent:'space-between',flexWrap:'nowrap',marginTop:12, width:'100%', maxWidth:1200}}>
      <KPIBarChart data={barChartData} />
      <StatusPieChart data={statusPieData} />
    </div>

    {/* Top Doctors + Recent Activities: side by side */}
  <div style={{display:'flex',gap:24,justifyContent:'center',flexWrap:'nowrap',marginTop:12, width:'100%', maxWidth:1200}}>
      <TopDoctors appointments={appointments} />
      <RecentActivities activities={recentActivities} />
    </div>
          {/* Cảnh báo nghiệp vụ */}
          {(kpi.overload || kpi.conflict) && (
            <div style={{
              background: kpi.overload ? '#ffebee' : '#fffde7',
              color: kpi.overload ? '#d32f2f' : '#fbc02d',
              border: '1.5px solid ' + (kpi.overload ? '#d32f2f' : '#fbc02d'),
              borderRadius:8, padding:'12px 24px', margin:'18px 0', fontWeight:600, fontSize:'1.08rem', maxWidth:1200, marginLeft:'auto', marginRight:'auto', display:'flex', alignItems:'center', gap:10, width:'100%'
            }}>
              <span style={{fontSize:22}}>{kpi.overload ? '⛔' : '⚠️'}</span>
              {kpi.overload && <span>Overload: More than 3 appointments at the same time for a doctor.</span>}
              {kpi.conflict && <span>Conflict: Duplicate appointment time for the same doctor.</span>}
            </div>
          )}
          {/* Shortcut nghiệp vụ */}
          <div style={{display:'flex', gap:24, justifyContent:'center', margin:'24px 0'}}>
            <button onClick={()=>handleShortcut('book')} style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:8,padding:'12px 28px',fontWeight:600,fontSize:'1.08rem',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}><FaCalendarAlt/> Book New Appointment</button>
            <button onClick={()=>handleShortcut('schedule')} style={{background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:8,padding:'12px 28px',fontWeight:600,fontSize:'1.08rem',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}><FaUserMd/> Doctor Schedules</button>
            <button onClick={()=>handleShortcut('kpi')} style={{background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:8,padding:'12px 28px',fontWeight:600,fontSize:'1.08rem',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}><FaChartBar/> KPI Reports</button>
          </div>
          {/* ...phần còn lại giữ nguyên... */}
          <div className="dashboard-bottom">
            <div className="quick-links">
              <div className="quick-links-title">Quick Links</div>
              <ul className="quick-link-list">
                <li><a href="#" onClick={e => {e.preventDefault(); onNavigate && onNavigate('appointments');}} style={{cursor:'pointer', color:'#1976d2', textDecoration:'underline'}}>Book New Appointment</a></li>
                <li><a href="#" onClick={e => {e.preventDefault(); onNavigate && onNavigate('patients');}} style={{cursor:'pointer', color:'#1976d2', textDecoration:'underline'}}>Add New Patient</a></li>
                <li><a href="#" onClick={e => {e.preventDefault(); onNavigate && onNavigate('appointments');}} style={{cursor:'pointer', color:'#1976d2', textDecoration:'underline'}}>Doctor Schedules</a></li>
                <li><a href="#" onClick={e => {e.preventDefault(); onNavigate && onNavigate('reports');}} style={{cursor:'pointer', color:'#1976d2', textDecoration:'underline'}}>View Reports</a></li>
              </ul>
            </div>
            <div className="dashboard-announcements">
              <div className="announcements-title">Announcements</div>
              <div className="announcement-item">System maintenance scheduled for 10:00 PM tonight.</div>
              <div className="announcement-item">New COVID-19 guidelines updated for all clinics.</div>
              <div className="announcement-item">Welcome Dr. Smith to our Pediatrics department!</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

