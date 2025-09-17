import React, { useMemo, useState } from 'react';
import './Reports.css';
import LineChart from '../components/LineChart';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppointmentContext } from '../contexts/AppointmentContext';

function exportReportCSV(appointments) {
  if (!appointments.length) return;
  const header = ['Date','Patient','Doctor','Service','Fee','Status'];
  const rows = appointments.map(a => [a.date, a.patient, a.doctor, a.service, a.fee ?? '', a.status]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clinic_report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function Reports({ onNavigate, currentPage }) {
  const { doctors, appointments: originalAppointments } = useAppointmentContext();
  // Mock thêm dữ liệu nhiều tháng cho BarChart
  const appointments = React.useMemo(() => [
    ...originalAppointments,
    // 2025-04: 1
    { id: 11, patient: 'Pham Van K', doctor: 'Dr. Smith', date: '2025-04-12', service: 'General Checkup', fee: 200000, status: 'Completed' },
    // 2025-05: 3
    { id: 9, patient: 'Tran Van I', doctor: 'Dr. John', date: '2025-05-18', service: 'ENT Exam', fee: 170000, status: 'Completed' },
    { id: 10, patient: 'Le Thi J', doctor: 'Dr. Anna', date: '2025-05-25', service: 'Cardiology', fee: 220000, status: 'Completed' },
    { id: 13, patient: 'Nguyen Van M', doctor: 'Dr. Smith', date: '2025-05-05', service: 'General Checkup', fee: 200000, status: 'Completed' },
    // 2025-06: 2
    { id: 6, patient: 'Tran Thi F', doctor: 'Dr. John', date: '2025-06-20', service: 'Eye Exam', fee: 150000, status: 'Completed' },
    { id: 8, patient: 'Pham Thi H', doctor: 'Dr. Smith', date: '2025-06-10', service: 'General Checkup', fee: 210000, status: 'Completed' },
    // 2025-07: 4
    { id: 5, patient: 'Nguyen Van E', doctor: 'Dr. Smith', date: '2025-07-15', service: 'General Checkup', fee: 200000, status: 'Completed' },
    { id: 7, patient: 'Le Van G', doctor: 'Dr. Anna', date: '2025-07-22', service: 'Dermatology', fee: 180000, status: 'Completed' },
    { id: 14, patient: 'Tran Van N', doctor: 'Dr. John', date: '2025-07-03', service: 'ENT Exam', fee: 170000, status: 'Completed' },
    { id: 15, patient: 'Le Thi O', doctor: 'Dr. Anna', date: '2025-07-28', service: 'Cardiology', fee: 220000, status: 'Completed' },
    // 2025-08: 2 (giữ nguyên 4 dòng gốc)
  ], [originalAppointments]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [doctorFilter, setDoctorFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Lọc dữ liệu theo bộ lọc
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const matchDoctor = !doctorFilter || app.doctor === doctorFilter;
      const matchService = !serviceFilter || app.service === serviceFilter;
      const matchStatus = !statusFilter || app.status === statusFilter;
      const matchDate = (!dateRange.from || new Date(app.date) >= new Date(dateRange.from)) &&
        (!dateRange.to || new Date(app.date) <= new Date(dateRange.to));
      return matchDoctor && matchService && matchStatus && matchDate;
    });
  }, [appointments, doctorFilter, serviceFilter, statusFilter, dateRange]);

  // Thống kê tổng hợp
  const totalPatients = useMemo(() => new Set(filteredAppointments.map(a => a.patient)).size, [filteredAppointments]);
  const totalAppointments = filteredAppointments.length;
  const totalRevenue = useMemo(() => filteredAppointments.reduce((sum, a) => sum + (a.fee || 0), 0), [filteredAppointments]);

  // KPI bác sĩ
  const doctorStats = useMemo(() => {
    return doctors.map(doc => {
      const docApps = filteredAppointments.filter(a => a.doctor === doc.name);
      return {
        id: doc.id,
        name: doc.name,
        specialty: doc.specialty,
        appointments: docApps.length,
        revenue: docApps.reduce((sum, a) => sum + (a.fee || 0), 0),
        rating: doc.kpi?.rating || '-',
      };
    });
  }, [doctors, filteredAppointments]);

  // Danh sách dịch vụ và trạng thái
  const serviceList = useMemo(() => {
    const set = new Set();
    appointments.forEach(a => a.service && set.add(a.service));
    return Array.from(set);
  }, [appointments]);
  const statusList = useMemo(() => {
    const set = new Set();
    appointments.forEach(a => a.status && set.add(a.status));
    return Array.from(set);
  }, [appointments]);

  return (
    <div className="dashboard-layout" style={{width:'100vw', minHeight:'100vh', background:'#f7faff', display:'flex'}}>
      <Sidebar onNavigate={onNavigate} currentPage={currentPage || 'reports'} />
  <div className="dashboard-main" style={{width:'100%', maxWidth:1400, margin:'0 auto', padding:'72px 12px 0 12px', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh'}}>
        <Header />
  <main className="reports-content" style={{width:'100%', maxWidth:1200, margin:'0 auto', flex:1, overflowY:'auto', paddingTop:48, paddingBottom:32}}>
    <div className="reports-card" style={{maxWidth: '1400px', margin: '64px auto 16px auto', padding: '40px 32px'}}>
            <h2 className="reports-title" style={{fontSize: '2.3rem', letterSpacing: '1.5px', textAlign: 'center'}}>Clinic Reports</h2>
            <div className="reports-filters" style={{justifyContent:'flex-start',gap:24}}>
              <button className="reports-export-btn" onClick={() => exportReportCSV(filteredAppointments)}>
                <span style={{fontSize:18}}>⬇️</span> Export CSV
              </button>
              <label>From: <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({...r, from: e.target.value}))} /></label>
              <label>To: <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({...r, to: e.target.value}))} /></label>
              <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
                <option value="">All Doctors</option>
                {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
                <option value="">All Services</option>
                {serviceList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                {statusList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="reports-summary-row" style={{gap:40, marginBottom:40}}>
              <div className="reports-summary-card" style={{boxShadow:'0 2px 12px #e0e7ef',background:'#e3f2fd',minWidth:320}}>
                <div className="reports-summary-title" style={{fontSize:22,textAlign:'center'}}>Summary</div>
                <ul className="reports-summary-list" style={{fontSize:17}}>
                  <li style={{marginBottom:8}}>Total patients: <b>{totalPatients}</b></li>
                  <li style={{marginBottom:8}}>Total appointments: <b>{totalAppointments}</b></li>
                  <li>Total revenue: <b>{totalRevenue.toLocaleString()} đ</b></li>
                </ul>
              </div>
              <div className="reports-summary-card" style={{flex:2,minWidth:420,boxShadow:'0 2px 12px #e0e7ef',background:'#f6fafd'}}>
                <div className="reports-summary-title" style={{fontSize:22,textAlign:'center'}}>Doctor KPI</div>
                <div style={{overflowX:'auto'}}>
                  <table className="reports-kpi-table" style={{minWidth:600,fontSize:16}}>
                    <thead>
                      <tr>
                        <th style={{textAlign:'center'}}>Name</th>
                        <th style={{textAlign:'center'}}>Specialty</th>
                        <th style={{textAlign:'center'}}>Appointments</th>
                        <th style={{textAlign:'center'}}>Revenue</th>
                        <th style={{textAlign:'center'}}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorStats.map(doc => (
                        <tr key={doc.id}>
                          <td style={{textAlign:'center'}}>{doc.name}</td>
                          <td style={{textAlign:'center'}}>{doc.specialty}</td>
                          <td style={{textAlign:'center'}}>{doc.appointments}</td>
                          <td style={{textAlign:'center'}}>{doc.revenue.toLocaleString()} đ</td>
                          <td style={{textAlign:'center'}}>{doc.rating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{display:'flex', gap:32, justifyContent:'center', marginTop:32}}>
              <div style={{background:'#fff', borderRadius:12, boxShadow:'0 2px 12px #e0e7ef', padding:32, maxWidth:500, flex:1}}>
                <h3 style={{color:'#1976d2',fontWeight:700,marginBottom:12,fontSize:20, textAlign:'center'}}>Appointments by Month</h3>
                <BarChart appointments={filteredAppointments} />
              </div>
              <div style={{background:'#fff', borderRadius:12, boxShadow:'0 2px 12px #e0e7ef', padding:32, maxWidth:600, flex:1}}>
                <h3 style={{color:'#1976d2',fontWeight:700,marginBottom:12,fontSize:20, textAlign:'center'}}>Revenue by Month</h3>
                <LineChart appointments={filteredAppointments} />
              </div>
            </div>
            <div style={{marginTop: 32, background:'#fff', borderRadius:12, boxShadow:'0 2px 12px #e0e7ef', padding:32, maxWidth:1200, marginLeft:'auto', marginRight:'auto'}}>
              <h3 style={{color:'#1976d2',fontWeight:700,marginBottom:12,fontSize:20, textAlign:'center'}}>Appointments Table</h3>
              <div style={{overflowX:'auto'}}>
                <table className="reports-kpi-table" style={{minWidth:900,fontSize:16}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'center'}}>Date</th>
                      <th style={{textAlign:'center'}}>Patient</th>
                      <th style={{textAlign:'center'}}>Doctor</th>
                      <th style={{textAlign:'center'}}>Service</th>
                      <th style={{textAlign:'center'}}>Fee</th>
                      <th style={{textAlign:'center'}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((a,i) => (
                      <tr key={i}>
                        <td style={{textAlign:'center'}}>{a.date}</td>
                        <td style={{textAlign:'center'}}>{a.patient}</td>
                        <td style={{textAlign:'center'}}>{a.doctor}</td>
                        <td style={{textAlign:'center'}}>{a.service}</td>
                        <td style={{textAlign:'center'}}>{a.fee?.toLocaleString()} đ</td>
                        <td style={{textAlign:'center'}}>{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function BarChart({ appointments }) {
  const data = React.useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      const m = a.date ? a.date.slice(0,7) : 'Unknown';
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort();
  }, [appointments]);
  if (!data.length) return <div style={{color:'#888'}}>No data</div>;
  const max = Math.max(...data.map(d => d[1]));
  return (
    <svg width={Math.max(320, data.length*60)} height={180} style={{background:'#f6fafd',borderRadius:8}}>
      {data.map(([month, count], i) => (
        <g key={month}>
          <rect x={i*60+30} y={160-count/max*120} width={32} height={count/max*120} fill="#1976d2" rx={6} />
          <text x={i*60+46} y={175} fontSize={13} textAnchor="middle" fill="#333">{month}</text>
          <text x={i*60+46} y={150-count/max*120} fontSize={13} textAnchor="middle" fill="#1976d2" fontWeight={600}>{count}</text>
        </g>
      ))}
    </svg>
  );
}

export default Reports;
