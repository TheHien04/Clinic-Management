import React from 'react';
import { Sankey, ResponsiveContainer, Tooltip } from 'recharts';

function AppointmentSankeyChart({ appointments }) {
  // Chuẩn hóa dữ liệu cho Sankey
  // Chỉ lấy các trạng thái chuyển đổi chính
  const nodes = [
    { name: 'Pending' },
    { name: 'Confirmed' },
    { name: 'Checked-in' },
    { name: 'Completed' },
    { name: 'Cancelled' },
  ];
  // Đếm số lượng chuyển đổi
  const links = [
    { source: 0, target: 1, value: appointments.filter(a => a.status === 'Confirmed').length },
    { source: 1, target: 2, value: appointments.filter(a => a.status === 'Checked-in').length },
    { source: 2, target: 3, value: appointments.filter(a => a.status === 'Completed').length },
    { source: 1, target: 4, value: appointments.filter(a => a.status === 'Cancelled').length },
  ];
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px #e0e7ef', padding: 18, minWidth: 320 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: '#1976d2', fontSize: '1.08rem' }}>Appointment Status Flow (Sankey)</div>
      <ResponsiveContainer width="100%" height={220}>
        <Sankey
          data={{ nodes, links }}
          nodePadding={30}
          margin={{ top: 20, bottom: 20 }}
          linkCurvature={0.5}
        >
          <Tooltip />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

export default AppointmentSankeyChart;
