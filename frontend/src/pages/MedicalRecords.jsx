import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Spinner from '../components/Spinner';
import Toast from '../components/Toast';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import { getMedicalRecordsAPI, deleteMedicalRecordAPI, createMedicalRecordAPI, updateMedicalRecordAPI } from '../services/medicalRecords';
import './MedicalRecords.css';
import './Common.css';

export default function MedicalRecords() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState({ search: '', startDate: '', endDate: '' });
  const [showModal, setShowModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formData, setFormData] = useState({
    appId: '',
    diagnosisCode: '',
    prescription: '',
    notes: '',
    followUpDate: ''
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Fetch medical records
  useEffect(() => {
    fetchRecords();
  }, [pagination.page, filter.startDate, filter.endDate]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined
      };
      
      const response = await getMedicalRecordsAPI(params);
      
      if (response.success) {
        setRecords(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Fetch records error:', error);
      setToast({ message: 'Error loading medical records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Filter records locally
  const filteredRecords = records.filter(record => {
    const searchLower = filter.search.toLowerCase();
    return (
      record.patient_name?.toLowerCase().includes(searchLower) ||
      record.doctor_name?.toLowerCase().includes(searchLower) ||
      record.diagnosis_code?.toLowerCase().includes(searchLower)
    );
  });

  // Handle create/update record
  const handleSaveRecord = async (e) => {
    e.preventDefault();
    
    try {
      if (!formData.diagnosisCode) {
        setToast({ message: 'Diagnosis code is required', type: 'error' });
        return;
      }

      let response;
      if (currentRecord) {
        // Update existing record
        response = await updateMedicalRecordAPI(currentRecord.record_id, formData);
      } else {
        // Create new record
        if (!formData.appId) {
          setToast({ message: 'Appointment ID is required', type: 'error' });
          return;
        }
        response = await createMedicalRecordAPI(formData);
      }

      if (response.success) {
        setToast({ 
          message: currentRecord ? 'Medical record updated successfully' : 'Medical record created successfully', 
          type: 'success' 
        });
        setShowModal(false);
        setCurrentRecord(null);
        setFormData({ appId: '', diagnosisCode: '', prescription: '', notes: '', followUpDate: '' });
        fetchRecords();
      }
    } catch (error) {
      console.error('Save record error:', error);
      setToast({ message: error.response?.data?.message || 'Error saving medical record', type: 'error' });
    }
  };

  // Handle delete record
  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medical record?')) {
      return;
    }

    try {
      const response = await deleteMedicalRecordAPI(id);
      if (response.success) {
        setToast({ message: 'Medical record deleted successfully', type: 'success' });
        fetchRecords();
      }
    } catch (error) {
      console.error('Delete record error:', error);
      setToast({ message: 'Error deleting medical record', type: 'error' });
    }
  };

  // Handle edit record
  const handleEditRecord = (record) => {
    setCurrentRecord(record);
    setFormData({
      appId: record.app_id,
      diagnosisCode: record.diagnosis_code,
      prescription: record.prescription || '',
      notes: record.notes || '',
      followUpDate: record.follow_up_date ? record.follow_up_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  // Handle view details
  const handleViewDetails = (record) => {
    alert(`Medical Record Details:\n\nPatient: ${record.patient_name}\nDoctor: ${record.doctor_name}\nDiagnosis: ${record.diagnosis_code}\nPrescription: ${record.prescription || 'N/A'}\nNotes: ${record.notes || 'N/A'}`);
  };

  // Pagination controls
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading && records.length === 0) return <Spinner />;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <div className="page-content">
          <h1 className="page-title">📋 Medical Records</h1>

          {/* Filter Section */}
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search patient, doctor, diagnosis..."
              className="filter-input"
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              style={{ flex: 1, maxWidth: 400 }}
            />
            <input
              type="date"
              className="filter-input"
              value={filter.startDate}
              onChange={(e) => setFilter(prev => ({ ...prev, startDate: e.target.value }))}
              placeholder="Start Date"
            />
            <input
              type="date"
              className="filter-input"
              value={filter.endDate}
              onChange={(e) => setFilter(prev => ({ ...prev, endDate: e.target.value }))}
              placeholder="End Date"
            />
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + New Record
            </button>
          </div>

          {/* Records Table */}
          <div className="table-wrapper" style={{ marginBottom: 24 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Diagnosis Code</th>
                  <th>Visit Date</th>
                  <th>Follow-up</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                      No medical records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.record_id}>
                      <td>{record.record_id}</td>
                      <td>{record.patient_name}</td>
                      <td>{record.doctor_name}</td>
                      <td>{record.specialty_name || 'N/A'}</td>
                      <td><span style={{ fontFamily: 'monospace', background: '#e3f2fd', padding: '2px 8px', borderRadius: 4 }}>{record.diagnosis_code}</span></td>
                      <td>{formatDate(record.scheduled_time)}</td>
                      <td>{formatDate(record.follow_up_date)}</td>
                      <td>
                        <button className="action-btn" onClick={() => handleViewDetails(record)} title="View Details" style={{ background: '#1976d2', color: '#fff' }}>
                          Details
                        </button>
                        <button className="action-btn" onClick={() => handleEditRecord(record)} title="Edit" style={{ background: '#43a047', color: '#fff' }}>
                          Edit
                        </button>
                        <button className="action-btn" onClick={() => handleDeleteRecord(record.record_id)} title="Delete" style={{ background: '#d32f2f', color: '#fff' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button 
                onClick={() => handlePageChange(pagination.page - 1)} 
                disabled={pagination.page === 1}
                className="btn-primary"
                style={{ opacity: pagination.page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ padding: '10px 20px', background: '#e3f2fd', borderRadius: 8, fontWeight: 600 }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button 
                onClick={() => handlePageChange(pagination.page + 1)} 
                disabled={pagination.page === pagination.totalPages}
                className="btn-primary"
                style={{ opacity: pagination.page === pagination.totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <h2 style={{ marginTop: 0, color: '#1976d2' }}>
                  {currentRecord ? 'Edit Medical Record' : 'Create Medical Record'}
                </h2>
                <form onSubmit={handleSaveRecord}>
                  {!currentRecord && (
                    <div className="form-group">
                      <label>Appointment ID *</label>
                      <input
                        type="number"
                        value={formData.appId}
                        onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
                        className="form-input"
                        required
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Diagnosis Code (ICD-10) *</label>
                    <input
                      type="text"
                      value={formData.diagnosisCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosisCode: e.target.value }))}
                      className="form-input"
                      placeholder="e.g., A00.0, J06.9"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Prescription</label>
                    <textarea
                      value={formData.prescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, prescription: e.target.value }))}
                      className="form-input"
                      rows={3}
                      placeholder="Medication details..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Medical Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="form-input"
                      rows={4}
                      placeholder="Doctor's notes..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, followUpDate: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="modal-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                    <button type="button" onClick={() => { setShowModal(false); setCurrentRecord(null); }} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      {currentRecord ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
      </div>
    </div>
  );
}
