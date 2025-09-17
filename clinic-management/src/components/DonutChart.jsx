import React from 'react';

function DonutChart({ data, colors, labels }) {
	// data: [number, number, ...]
	// colors: [string, string, ...]
	// labels: [string, string, ...]
	const total = data.reduce((a, b) => a + b, 0);
	const radius = 50;
	const thickness = 22;
	let startAngle = 0;

	// Tính các đoạn cung cho từng phần
	const arcs = data.map((value, i) => {
		const angle = (value / (total || 1)) * 360;
		const endAngle = startAngle + angle;
		const largeArc = angle > 180 ? 1 : 0;
		const start = polarToCartesian(radius, radius, radius, startAngle);
		const end = polarToCartesian(radius, radius, radius, endAngle);
		const arcPath = [
			`M ${start.x} ${start.y}`,
			`A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
			`L ${radius} ${radius}`
		].join(' ');
		startAngle = endAngle;
		return { arcPath, color: colors[i], value, label: labels[i], angle };
	});

	function polarToCartesian(cx, cy, r, angle) {
		const rad = (angle - 90) * Math.PI / 180.0;
		return {
			x: cx + r * Math.cos(rad),
			y: cy + r * Math.sin(rad)
		};
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
			<svg width={120} height={120} viewBox="0 0 100 100">
				<g>
					{arcs.map((arc, i) => (
						<path key={i} d={arc.arcPath} fill={arc.color} stroke="#fff" strokeWidth={2} />
					))}
					{/* Lỗ ở giữa */}
					<circle cx={50} cy={50} r={radius - thickness} fill="#fff" />
				</g>
			</svg>
			<div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
				{arcs.map((arc, i) => (
					<span key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 15 }}>
						<span style={{ width: 14, height: 14, background: arc.color, borderRadius: '50%', display: 'inline-block', marginRight: 6 }}></span>
						{arc.label}: <b style={{ marginLeft: 3 }}>{arc.value}</b>
					</span>
				))}
			</div>
		</div>
	);
}

export default DonutChart;
