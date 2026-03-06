import React, { useState } from 'react';
import './PatientForm.css';

export default function PatientForm({ open, onClose, onSave, patient }) {
  const [name, setName] = useState(patient?.name || '');
  const [warning, setWarning] = useState(patient?.warning || '');

  if (!open) return null;
  return (
    <div className="patient-modal-overlay">
      <div className="patient-modal">
        <div className="patient-modal-header">
          <h3>{patient ? 'Edit Patient' : 'Add Patient'}</h3>
          <button className="patient-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave({ ...patient, name, warning }); }}>
          <div className="patient-modal-body">
            <label>Name:<br/>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>Warning/Note:<br/>
              <input value={warning} onChange={e => setWarning(e.target.value)} placeholder="e.g. Chronic disease, allergy..." />
            </label>
          </div>
          <div className="patient-modal-actions">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
