import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function StackedBarStatusChart({ appointments }) {
  // Gom nhóm theo ngày và trạng thái
  const statusList = ['Confirmed', 'Pending', 'Completed', 'Cancelled', 'Checked-in'];
  const colorMap = {
    Confirmed: '#1976d2',
    Pending: '#fbc02d',
    Completed: '#43a047',
    Cancelled: '#d32f2f',
    'Checked-in': '#0288d1',
  };
  const dateMap = {};
  appointments.forEach(a => {
    if (!dateMap[a.date]) dateMap[a.date] = {};
    statusList.forEach(s => { if (!dateMap[a.date][s]) dateMap[a.date][s] = 0; });
    dateMap[a.date][a.status]++;
  });
  const data = Object.entries(dateMap).map(([date, obj]) => ({ date, ...obj }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{top:8,right:16,left:0,bottom:8}}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{fontSize:13}} />
        <YAxis allowDecimals={false} tick={{fontSize:13}} />
        <Tooltip />
        <Legend />
        {statusList.map(s => (
          <Bar key={s} dataKey={s} stackId="a" fill={colorMap[s]} radius={[8,8,0,0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default StackedBarStatusChart;
