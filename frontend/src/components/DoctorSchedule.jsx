import React, { useState } from 'react';
import './DoctorSchedule.css';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const shifts = ['Morning', 'Afternoon', 'Evening'];

export default function DoctorSchedule({ open, onClose, doctor, onSave }) {
  const [schedule, setSchedule] = useState(doctor?.schedule || {});

  if (!open) return null;

  const handleChange = (day, shift) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [shift]: !prev[day]?.[shift]
      }
    }));
  };

  return (
    <div className="doctor-modal-overlay">
      <div className="doctor-modal">
        <div className="doctor-modal-header">
          <h3>Schedule for {doctor.name}</h3>
          <button className="doctor-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="doctor-modal-body">
          <table className="doctor-schedule-table">
            <thead>
              <tr>
                <th>Day</th>
                {shifts.map(s => <th key={s}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td>{day}</td>
                  {shifts.map(shift => (
                    <td key={shift}>
                      <input type="checkbox" checked={!!schedule[day]?.[shift]} onChange={() => handleChange(day, shift)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="doctor-modal-actions">
          <button onClick={() => { onSave(schedule); onClose(); }}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
