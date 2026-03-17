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
    return count > 0 ? <Badge count={count} style={{ backgroundColor: 'var(--brand-500)' }} /> : null;
  }

  return (
    <div className="ap-calendar-shell">
      <Calendar
        dateCellRender={dateCellRender}
        fullscreen={false}
        style={{ width: '100%' }}
      />
    </div>
  );
}

export default AppointmentCalendarChart;
