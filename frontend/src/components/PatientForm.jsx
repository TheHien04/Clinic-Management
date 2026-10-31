import React, { useState } from 'react';
import './PatientForm.css';

export default function PatientForm({ open, onClose, onSave, patient }) {
  const [name, setName] = useState(patient?.name || '');
  const [warning, setWarning] = useState(patient?.warning || '');
  const [phone, setPhone] = useState(patient?.phone || '');
  const [email, setEmail] = useState(patient?.email || '');
  const [dob, setDob] = useState(patient?.dob || '');
  const [gender, setGender] = useState(patient?.gender || '');
  const [address, setAddress] = useState(patient?.address || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;
  return (
    <div className="patient-modal-overlay">
      <div className="patient-modal">
        <div className="patient-modal-header">
          <h3>{patient ? 'Edit Patient' : 'Add Patient'}</h3>
          <button className="patient-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError('');
          try {
            await onSave({ ...patient, name, warning, phone, email, dob, gender, address });
          } catch (saveError) {
            setError(saveError?.message || 'Unable to save patient.');
          } finally {
            setSaving(false);
          }
        }}>
          <div className="patient-modal-body">
            <label>Full name<br/>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>Phone<br/>
              <input value={phone} onChange={e => setPhone(e.target.value)} required inputMode="tel" />
            </label>
            <label>Email<br/>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" />
            </label>
            <label>Date of birth<br/>
              <input value={dob} onChange={e => setDob(e.target.value)} type="date" />
            </label>
            <label>Gender<br/>
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </label>
            <label>Address<br/>
              <input value={address} onChange={e => setAddress(e.target.value)} />
            </label>
            <label>Clinical history / care note<br/>
              <input value={warning} onChange={e => setWarning(e.target.value)} placeholder="e.g. Chronic disease, allergy..." />
            </label>
            {error && <div className="patient-form-error" role="alert">{error}</div>}
          </div>
          <div className="patient-modal-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save to SQL'}</button>
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
