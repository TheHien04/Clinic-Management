import React from 'react';

export default function AvatarIcon({ name, size = 32 }) {
  // Simple avatar: use first letter, color by type
  const color = '#1976d2';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size/2
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}
