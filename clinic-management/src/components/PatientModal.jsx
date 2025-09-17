import React from 'react';
import './PatientModal.css';

export default function PatientModal({ open, onClose, patient, history, onBook, onEdit, onDelete }) {
  if (!open) return null;
  return (
    <div className="patient-modal-overlay">
      <div className="patient-modal">
        <div className="patient-modal-header">
          <h3>Patient Record: {patient.name}</h3>
          <button className="patient-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="patient-modal-body">
          <div><b>ID:</b> {patient.id}</div>
          <div><b>Name:</b> {patient.name}</div>
          {patient.warning && <div className="patient-warning">⚠ {patient.warning}</div>}
          <div style={{marginTop:12}}><b>Visit History:</b></div>
          <table className="patient-modal-table">
            <thead><tr><th>Date</th><th>Doctor</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{h.date}</td>
                  <td>{h.doctor}</td>
                  <td>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="patient-modal-actions">
          <button onClick={onBook}>Book Re-exam</button>
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete} style={{color:'#d32f2f'}}>Delete</button>
        </div>
      </div>
    </div>
  );
}
