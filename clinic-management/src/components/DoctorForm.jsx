import React, { useState } from 'react';
import './DoctorForm.css';

export default function DoctorForm({ open, onClose, onSave, doctor }) {
  const [name, setName] = useState(doctor?.name || '');
  const [specialty, setSpecialty] = useState(doctor?.specialty || '');
  const [status, setStatus] = useState(doctor?.status || 'active');
  const [contact, setContact] = useState(doctor?.contact || '');

  if (!open) return null;
  return (
    <div className="doctor-modal-overlay">
      <div className="doctor-modal">
        <div className="doctor-modal-header">
          <h3>{doctor ? 'Edit Doctor' : 'Add Doctor'}</h3>
          <button className="doctor-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave({ ...doctor, name, specialty, status, contact }); }}>
          <div className="doctor-modal-body">
            <label>Name:<br/>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>Specialty:<br/>
              <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Cardiology, Pediatrics..." />
            </label>
            <label>Status:<br/>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="onleave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>Contact:<br/>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone, email..." />
            </label>
          </div>
          <div className="doctor-modal-actions">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
