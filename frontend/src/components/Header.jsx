import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';
import { STORAGE_KEYS, ROUTES } from '../constants';

export default function Header() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
  
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    navigate(`/${ROUTES.LOGIN}`);
  };
  
  return (
    <header className="header">
      <div className="header-title">Dashboard</div>
      <div className="header-user">
        <span className="user-avatar">👤</span>
        <span className="user-name">{user.email || 'Admin'}</span>
        {user.email && (
          <button className="logout-btn" onClick={handleLogout} style={{marginLeft:12,background:'#fff',color:'#1976d2',border:'1.5px solid #1976d2',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer'}}>Logout</button>
        )}
      </div>
    </header>
  );
}
