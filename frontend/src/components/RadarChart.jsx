import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

function DoctorRadarChart({ doctors }) {
  // Chuẩn hóa dữ liệu cho radar chart
  const data = doctors.map(d => ({
    name: d.name.replace('Dr. ', ''),
    KPI: d.kpi?.month ?? 0,
    Rating: d.kpi?.rating ?? 0,
    Patients: Array.isArray(d.patients) ? d.patients.length : d.patients ?? 0,
    Appointments: d.appointments ?? 0,
  }));
  // Chỉ lấy top 5 bác sĩ (hoặc tất cả nếu ít hơn)
  const chartData = data.slice(0, 5);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart cx="50%" cy="50%" outerRadius={90} data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
        <Radar name="KPI" dataKey="KPI" stroke="var(--brand-500)" fill="var(--brand-500)" fillOpacity={0.5} />
        <Radar name="Rating" dataKey="Rating" stroke="var(--success-fg)" fill="var(--success-fg)" fillOpacity={0.4} />
        <Radar name="Patients" dataKey="Patients" stroke="var(--warning-fg)" fill="var(--warning-fg)" fillOpacity={0.3} />
        <Radar name="Appointments" dataKey="Appointments" stroke="var(--danger-fg)" fill="var(--danger-fg)" fillOpacity={0.2} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default DoctorRadarChart;
