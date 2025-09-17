import React from 'react';
import './Header.css';

export default function Header({ onLogout }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return (
    <header className="header">
      <div className="header-title">Dashboard</div>
      <div className="header-user">
        <span className="user-avatar">👤</span>
        <span className="user-name">{user.email || 'Admin'}</span>
        {user.email && (
          <button className="logout-btn" onClick={onLogout} style={{marginLeft:12,background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer'}}>Logout</button>
        )}
      </div>
    </header>
  );
}
