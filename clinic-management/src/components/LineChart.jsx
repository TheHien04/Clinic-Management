import React from 'react';

function LineChart({ appointments }) {
  // Tính tổng revenue theo từng tháng
  const data = React.useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      if (!a.date || !a.fee) return;
      const m = a.date.slice(0, 7); // yyyy-mm
      map[m] = (map[m] || 0) + a.fee;
    });
    return Object.entries(map).sort();
  }, [appointments]);

  if (!data.length) return <div style={{ color: '#888' }}>No data</div>;
  const max = Math.max(...data.map(d => d[1]));
  const min = Math.min(...data.map(d => d[1]));
  const chartWidth = Math.max(320, data.length * 60);
  const chartHeight = 180;
  const points = data.map(([month, revenue], i) => {
    const x = i * 60 + 46;
    const y = chartHeight - ((revenue - min) / (max - min || 1)) * 120 - 20;
    return { x, y, month, revenue };
  });

  return (
    <svg width={chartWidth} height={chartHeight} style={{ background: '#f6fafd', borderRadius: 8 }}>
      {/* Đường nối các điểm */}
      {points.length > 1 && (
        <polyline
          fill="none"
          stroke="#1976d2"
          strokeWidth={3}
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
        />
      )}
      {/* Vẽ các điểm */}
      {points.map(p => (
        <g key={p.month}>
          <circle cx={p.x} cy={p.y} r={6} fill="#1976d2" />
          <text x={p.x} y={p.y - 12} fontSize={13} textAnchor="middle" fill="#1976d2" fontWeight={600}>{p.revenue.toLocaleString()} đ</text>
          <text x={p.x} y={chartHeight - 5} fontSize={13} textAnchor="middle" fill="#333">{p.month}</text>
        </g>
      ))}
    </svg>
  );
}

export default LineChart;
