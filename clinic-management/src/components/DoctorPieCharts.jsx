import React from 'react';
import DonutChart from './DonutChart';

const DoctorPieCharts = ({ doctors }) => {
  // Specialty Pie
  const specialtyMap = {};
  doctors.forEach(d => {
    if (Array.isArray(d.specialty)) d.specialty.forEach(s => specialtyMap[s] = (specialtyMap[s] || 0) + 1);
    else if (d.specialty) specialtyMap[d.specialty] = (specialtyMap[d.specialty] || 0) + 1;
  });
  const specialtyData = Object.entries(specialtyMap).map(([label, value]) => ({ label, value }));
  const specialtyColors = ['#1976d2','#43a047','#ffa000','#d32f2f','#0288d1','#8e24aa','#fbc02d'];

  // Status Pie
  const statusMap = { Active: 0, 'On Leave': 0, Inactive: 0 };
  doctors.forEach(d => {
    if (d.status === 'active') statusMap['Active']++;
    if (d.status === 'onleave') statusMap['On Leave']++;
    if (d.status === 'inactive') statusMap['Inactive']++;
  });
  const statusData = Object.entries(statusMap).map(([label, value]) => ({ label, value }));
  const statusColors = ['#43a047','#ffa000','#d32f2f'];

  return (
    <div style={{display:'flex',gap:32,justifyContent:'center',flexWrap:'wrap'}}>
      <div style={{background:'#fff',borderRadius:10,boxShadow:'0 2px 8px #e0e7ef',padding:18,minWidth:260}}>
        <div style={{fontWeight:600,marginBottom:10,color:'#1976d2',fontSize:'1.08rem'}}>Specialty Ratio</div>
        <DonutChart
          data={specialtyData.map(d => d.value)}
          colors={specialtyColors}
          labels={specialtyData.map(d => d.label)}
        />
      </div>
      <div style={{background:'#fff',borderRadius:10,boxShadow:'0 2px 8px #e0e7ef',padding:18,minWidth:260}}>
        <div style={{fontWeight:600,marginBottom:10,color:'#1976d2',fontSize:'1.08rem'}}>Status Ratio</div>
        <DonutChart
          data={statusData.map(d => d.value)}
          colors={statusColors}
          labels={statusData.map(d => d.label)}
        />
      </div>
    </div>
  );
}
export default DoctorPieCharts;
