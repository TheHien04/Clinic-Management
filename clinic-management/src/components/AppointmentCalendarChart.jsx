import React from 'react';
import { Calendar, Badge } from 'antd';
import 'antd/dist/reset.css';

function AppointmentCalendarChart({ appointments }) {
  // Gom nhóm số lượng lịch hẹn theo ngày
  const dateMap = {};
  appointments.forEach(a => {
    if (!dateMap[a.date]) dateMap[a.date] = 0;
    dateMap[a.date]++;
  });

  function dateCellRender(value) {
    const dateStr = value.format('YYYY-MM-DD');
    const count = dateMap[dateStr] || 0;
    return count > 0 ? <Badge count={count} style={{ backgroundColor: '#1976d2' }} /> : null;
  }

  return (
  <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(25, 118, 210, 0.1)', padding: 0, minWidth: 320, width: '100%', maxWidth: 1400, margin: '0 auto', border: '1.5px solid #e3f2fd' }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: '#1976d2', fontSize: '1.08rem' }}>Appointments Calendar</div>
      <Calendar dateCellRender={dateCellRender} style={{ width: '100%' }} />
    </div>
  );
}

export default AppointmentCalendarChart;
