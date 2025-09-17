import React from 'react';
import './Toast.css';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  return (
    <div className={`toast toast-${type}`}> 
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}
