import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetailsIcon, EditIcon, DeleteIcon } from '../components/icons';
import PatientModal from '../components/PatientModal';
import PatientForm from '../components/PatientForm';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { getAppointmentsForAnalyticsAPI } from '../services/appointments';
import { createPatientAPI, deletePatientAPI, getPatientIntelligenceAPI, getPatientsAPI, updatePatientAPI } from '../services/patients';
import { FaArrowRight, FaCheckCircle, FaDatabase, FaDna, FaExchangeAlt, FaHeartbeat, FaPhoneAlt, FaSearch, FaShieldAlt, FaUserPlus } from 'react-icons/fa';
import './Patients.css';
import './Common.css';
import './CareWorkspace.css';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [chronicFilter, setChronicFilter] = useState(false);
  const [emailFilter, setEmailFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [idFilter, setIdFilter] = useState('');
  const [lastVisitFilter, setLastVisitFilter] = useState('');
  const [visitCountFilter, setVisitCountFilter] = useState('');
  const [modalPatient, setModalPatient] = useState(null);
  const [modalHistory, setModalHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [outreachLedger, setOutreachLedger] = useState({});
  const [workspaceNotice, setWorkspaceNotice] = useState('');
  const [patientData, setPatientData] = useState([]);
  const [appointmentData, setAppointmentData] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [dataOrigin, setDataOrigin] = useState('Loading governed data…');
  const [tablePage, setTablePage] = useState(1);
  const searchInputRef = useRef(null);
  const growthRef = useRef(null);
  const tableRef = useRef(null);
  const riskRef = useRef(null);
  const outreachRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadGovernedData = async () => {
      try {
        const [patients, appointments, overview] = await Promise.all([
          getPatientsAPI({ limit: 500 }).catch(() => null),
          getAppointmentsForAnalyticsAPI({ limit: 2000 }).catch(() => null),
          getPatientIntelligenceAPI().catch(() => null),
        ]);

        if (!active) return;
        const normalizedPatients = (Array.isArray(patients) ? patients : []).map((patient) => ({
          id: patient.PatientID,
          name: patient.FullName,
          email: patient.Email || '',
          phone: patient.PhoneNumber || '',
          warning: patient.MedicalHistory || '',
          dob: patient.DateOfBirth ? String(patient.DateOfBirth).slice(0, 10) : '',
          gender: patient.Gender || '',
          address: patient.Address || '',
          createdDate: patient.CreatedDate ? String(patient.CreatedDate).slice(0, 10) : '',
          recordVersion: patient.RecordVersion || null,
        }));

        setPatientData(normalizedPatients);
        setAppointmentData(Array.isArray(appointments) ? appointments : []);
        setIntelligence(overview || null);
        setDataOrigin(normalizedPatients.length && overview
          ? 'Synthetic clinical dataset · SQL source of truth'
          : normalizedPatients.length
            ? 'SQL patient registry live · care intelligence temporarily unavailable'
            : 'Governed backend unavailable · no mock data displayed');
      } catch {
        if (!active) return;
        setPatientData([]);
        setAppointmentData([]);
        setIntelligence(null);
        setDataOrigin('Governed backend unavailable · no mock data displayed');
      }
    };

    loadGovernedData();
    return () => { active = false; };
  }, []);

  const patientList = useMemo(() => {
    return patientData;
  }, [patientData]);

  const getCompletedHistory = useCallback((patient) => {
    const today = new Date().toISOString().slice(0, 10);
    return appointmentData
      .filter((appointment) => (
        Number(appointment.patientId) === Number(patient.id)
        || (!appointment.patientId && appointment.patient === patient.name)
      ))
      .filter((appointment) => appointment.status === 'completed' && appointment.date && appointment.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || '')));
  }, [appointmentData]);

  // Advanced filters use completed encounters, not future bookings, so the
  // table and the SQL risk model share one defensible definition of a visit.
  const filtered = patientList.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(search.toLowerCase());
    const emailMatch = !emailFilter || (p.email && p.email.toLowerCase().includes(emailFilter.toLowerCase()));
    const phoneMatch = !phoneFilter || (p.phone && p.phone.includes(phoneFilter));
    const idMatch = !idFilter || String(p.id).includes(idFilter);
    const chronicMatch = !chronicFilter || (p.warning && p.warning.toLowerCase().includes('chronic'));
    const doctorMatch = !doctorFilter || appointmentData.some(a => (
      (Number(a.patientId) === Number(p.id) || (!a.patientId && a.patient === p.name))
      && a.doctor === doctorFilter
    ));
    const history = getCompletedHistory(p);
    const lastVisit = history[0]?.date || '';
    const lastVisitMatch = !lastVisitFilter || (lastVisit && lastVisit >= lastVisitFilter);
    const visitCountMatch = !visitCountFilter || history.length >= Number(visitCountFilter);
    return nameMatch && emailMatch && phoneMatch && idMatch && chronicMatch && doctorMatch && lastVisitMatch && visitCountMatch;
  });

  // Keep inactive/care-gap patients visible. Silently limiting the table to
  // recent visitors would hide the very cohort outreach teams must recover.
  const filteredRecent = filtered;

  const tablePageSize = 25;
  const tablePageCount = Math.max(1, Math.ceil(filteredRecent.length / tablePageSize));
  const paginatedPatients = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredRecent.slice(start, start + tablePageSize);
  }, [filteredRecent, tablePage]);

  useEffect(() => {
    setTablePage(1);
  }, [search, doctorFilter, chronicFilter, emailFilter, phoneFilter, idFilter, lastVisitFilter, visitCountFilter]);

  useEffect(() => {
    setTablePage((current) => Math.min(current, tablePageCount));
  }, [tablePageCount]);

  // Lấy lịch sử khám cho từng bệnh nhân
  const getHistory = useCallback(
    (patient) => appointmentData
      .filter((appointment) => (
        Number(appointment.patientId) === Number(patient.id)
        || (!appointment.patientId && appointment.patient === patient.name)
      ))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || ''))),
    [appointmentData],
  );

  // Do not manufacture clinical-looking priorities in the browser when the
  // governed backend model is unavailable. Preview records may still support
  // layout review, but the decision-support surfaces remain empty.
  const localPatientRiskRows = useMemo(() => [], []);

  const patientRiskRows = useMemo(() => {
    if (!intelligence) return localPatientRiskRows;
    const visibleIds = new Set(filteredRecent.map((patient) => Number(patient.id)));
    return (intelligence.riskRows || []).filter((row) => visibleIds.has(Number(row.id)));
  }, [filteredRecent, intelligence, localPatientRiskRows]);

  const derivedRiskCohorts = useMemo(() => {
    const summarize = (members) => ({
      count: members.length,
      avg: members.length ? Math.round(members.reduce((sum, row) => sum + row.riskScore, 0) / members.length) : 0,
      confidence: members.length ? Math.round(members.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / members.length) : 0,
    });

    const high = patientRiskRows.filter((row) => row.riskBand === 'high');
    const medium = patientRiskRows.filter((row) => row.riskBand === 'medium');
    const low = patientRiskRows.filter((row) => row.riskBand === 'low');
    return {
      high: summarize(high),
      medium: summarize(medium),
      low: summarize(low),
    };
  }, [patientRiskRows]);

  const riskCohorts = derivedRiskCohorts;

  const outreachQueue = useMemo(() => {
    return patientRiskRows
      .filter((row) => row.riskBand !== 'low')
      .map((row, index) => ({
        ...row,
        etaHours: row.riskBand === 'high' ? 24 : 48,
        queueRank: index + 1,
      }))
      .slice(0, 8);
  }, [patientRiskRows]);

  const careGapCount = patientRiskRows.filter((row) => row.daysSinceLastVisit >= 90).length;

  const handleOutreach = (row) => {
    const contactedAt = new Date().toISOString();
    setOutreachLedger((current) => ({ ...current, [row.id]: contactedAt }));
    setWorkspaceNotice(`${row.name} was moved into the active outreach workflow.`);
    window.setTimeout(() => setWorkspaceNotice(''), 3600);
  };

  // CRUD
  const handleAdd = () => { setEditPatient(null); setShowForm(true); };
  const handleEdit = (p) => { setEditPatient(p); setShowForm(true); };
  const handleDelete = async (p) => {
    if (window.confirm('Delete patient ' + p.name + '?')) {
      try {
        await deletePatientAPI(p.id);
        setPatientData((current) => current.filter((patient) => patient.id !== p.id));
        setWorkspaceNotice(`${p.name} was deleted from the SQL patient registry.`);
      } catch (error) {
        setWorkspaceNotice(error?.message || 'Unable to delete this patient. Existing visits must be retained.');
      }
    }
  };
  const handleSave = async (data) => {
    const payload = {
      fullName: data.name,
      dateOfBirth: data.dob || null,
      gender: data.gender || null,
      phoneNumber: data.phone,
      email: data.email || null,
      address: data.address || null,
      medicalHistory: data.warning || null,
      recordVersion: data.recordVersion || null,
    };

    const saved = data.id
      ? await updatePatientAPI(data.id, payload)
      : await createPatientAPI(payload);
    const normalized = {
      id: saved.PatientID,
      name: saved.FullName,
      email: saved.Email || '',
      phone: saved.PhoneNumber || '',
      warning: saved.MedicalHistory || '',
      dob: saved.DateOfBirth ? String(saved.DateOfBirth).slice(0, 10) : '',
      gender: saved.Gender || '',
      address: saved.Address || '',
      createdDate: saved.CreatedDate ? String(saved.CreatedDate).slice(0, 10) : '',
      recordVersion: saved.RecordVersion || null,
    };
    setPatientData((current) => data.id
      ? current.map((patient) => patient.id === data.id ? normalized : patient)
      : [normalized, ...current]);
    setWorkspaceNotice(`${normalized.name} was saved to SQL successfully.`);
    setShowForm(false);
  };

  // Modal chi tiết
  const handleView = (p) => {
    setModalPatient(p);
    setModalHistory(getHistory(p));
  };
  const handleCloseModal = () => setModalPatient(null);
  const handleBook = () => {
    alert('Book re-exam for ' + modalPatient.name);
    setModalPatient(null);
  };

  // Download PDF mock
  const handleDownload = (p) => {
    alert('Download PDF for ' + p.name);
  };

  // Lấy danh sách bác sĩ
  const doctorList = useMemo(() => {
    const set = new Set();
    appointmentData.forEach(a => set.add(a.doctor));
    return Array.from(set);
  }, [appointmentData]);

  // Thống kê nhanh
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const stats = useMemo(() => {
    let chronic = 0, newThisMonth = 0;
    patientList.forEach(p => {
      if (p.warning && p.warning.trim()) chronic++;
      if (p.createdDate?.startsWith(thisMonth)) {
        newThisMonth++;
      } else if (!p.createdDate) {
        const history = appointmentData.filter(a => a.patient === p.name);
        if (history.length && history[history.length - 1].date?.startsWith(thisMonth)) newThisMonth++;
      }
    });
    return { total: patientList.length, chronic, newThisMonth };
  }, [appointmentData, patientList, thisMonth]);


  const runPatientsCommand = useCallback((action) => {
    if (!action) return;

    if (action === 'add') {
      setEditPatient(null);
      setShowForm(true);
      return;
    }

    if (action === 'filter-chronic') {
      setChronicFilter(true);
      return;
    }

    if (action === 'clear-filters') {
      setSearch('');
      setDoctorFilter('');
      setChronicFilter(false);
      setEmailFilter('');
      setPhoneFilter('');
      setIdFilter('');
      setLastVisitFilter('');
      setVisitCountFilter('');
      return;
    }

    if (action === 'focus-search') {
      searchInputRef.current?.focus();
      return;
    }

    if (action === 'jump-growth') {
      growthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-table') {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-risk') {
      riskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'jump-outreach') {
      outreachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'focus-high-risk') {
      setChronicFilter(true);
      riskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const urlAction = new URLSearchParams(window.location.search).get('cp_action');
    if (urlAction) {
      runPatientsCommand(urlAction);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const onCommand = (event) => {
      const action = event?.detail?.action;
      runPatientsCommand(action);
    };

    window.addEventListener('patients:command', onCommand);
    return () => window.removeEventListener('patients:command', onCommand);
  }, [runPatientsCommand]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main id="main-content" tabIndex="-1" className="patients-content">
          <section className="care-workspace-hero patients-workspace-hero">
            <div className="care-workspace-copy">
              <span className="care-eyebrow"><FaHeartbeat aria-hidden="true" /> Longitudinal care intelligence</span>
              <h1>Know who needs care <em>before they ask.</em></h1>
              <p>Turn patient history, chronic conditions and visit gaps into a prioritized outreach workflow your care team can act on now.</p>
              <div className="care-hero-actions">
                <button type="button" className="care-action-primary" onClick={() => outreachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  Open outreach queue <FaArrowRight aria-hidden="true" />
                </button>
                <button type="button" className="care-action-secondary" onClick={handleAdd}><FaUserPlus aria-hidden="true" /> Add patient</button>
              </div>
            </div>
            <div className="care-workspace-metrics" aria-label="Patient care priorities">
              <article className="is-critical"><span>High priority</span><b>{riskCohorts.high.count || 'Clear'}</b><small>{riskCohorts.high.count ? 'Requires 24h review' : 'No urgent review queue'}</small></article>
              <article><span>Care gaps</span><b>{careGapCount || 'Clear'}</b><small>{careGapCount ? 'No visit in 90+ days' : 'Continuity up to date'}</small></article>
              <article><span>Patient histories</span><b>{stats.total || '—'}</b><small>{stats.chronic} with documented conditions</small></article>
            </div>
          </section>
          <h2 className="care-sr-only">Patients</h2>
          {workspaceNotice && <div className="care-notice" role="status"><FaCheckCircle aria-hidden="true" /> {workspaceNotice}</div>}
          <div className="care-section-heading">
            <div><span>Patient operations</span><h3>Patient access desk</h3></div>
            <small>{dataOrigin}</small>
          </div>
          <section className="patients-access-desk" ref={growthRef} aria-label="Patient access actions">
            <div className="patients-access-actions">
              <button type="button" onClick={handleAdd}><FaUserPlus aria-hidden="true" /><span><b>Register patient</b><small>Create identity, contact and consent record</small></span><FaArrowRight aria-hidden="true" /></button>
              <button type="button" onClick={() => searchInputRef.current?.focus()}><FaSearch aria-hidden="true" /><span><b>Find patient</b><small>Search the governed longitudinal registry</small></span><FaArrowRight aria-hidden="true" /></button>
              <button type="button" onClick={() => outreachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FaPhoneAlt aria-hidden="true" /><span><b>Recover care gaps</b><small>Open the clinician-reviewed outreach queue</small></span><FaArrowRight aria-hidden="true" /></button>
            </div>
            <div className="patients-access-worklist">
              <div className="patients-access-head"><span>Next patients to review</span><small>{stats.total} registered · {stats.newThisMonth} new this month</small></div>
              {outreachQueue.slice(0, 3).map((row) => (
                <article key={`access-${row.id}`}>
                  <span className={`patients-access-risk is-${row.riskBand}`}>{row.riskBand}</span>
                  <div><b>{row.name}</b><small>{row.outreachPriority} · last visit {row.lastVisit || 'not recorded'}</small></div>
                  <button type="button" onClick={() => {
                    const patient = patientList.find((item) => Number(item.id) === Number(row.id));
                    if (patient) handleView(patient);
                  }}>Open 360°</button>
                </article>
              ))}
              {outreachQueue.length === 0 && <div className="patients-access-empty"><FaCheckCircle aria-hidden="true" /><span><b>No escalated patient tasks</b><small>Use Find patient or register a new patient to continue.</small></span></div>}
            </div>
          </section>
          <div className="patients-search-row">
            {/* Filter summary/info block to fill whitespace */}
            <div className="patients-filter-summary">
              <FaSearch aria-hidden="true" className="patients-filter-icon" />
              <div className="patients-filter-content">
                <div className="patients-filter-title">Filters</div>
                <div className="patients-filter-values">
                  {search && <span>Name: <b>{search}</b> </span>}
                  {emailFilter && <span>Email: <b>{emailFilter}</b> </span>}
                  {phoneFilter && <span>Phone: <b>{phoneFilter}</b> </span>}
                  {idFilter && <span>ID: <b>{idFilter}</b> </span>}
                  {lastVisitFilter && <span>Last Visit: <b>{lastVisitFilter}</b> </span>}
                  {visitCountFilter && <span>Visits ≥ <b>{visitCountFilter}</b> </span>}
                  {doctorFilter && <span>Doctor: <b>{doctorFilter}</b> </span>}
                  {chronicFilter && <span>Chronic only </span>}
                  {(!search && !doctorFilter && !chronicFilter && !emailFilter && !phoneFilter && !idFilter && !lastVisitFilter && !visitCountFilter) && <span className="patients-filter-none">No filters applied, showing all patients.</span>}
                </div>
              </div>
            </div>
            {/* ...existing code... */}
            <input ref={searchInputRef} type="text" placeholder="Name..." value={search} onChange={e => setSearch(e.target.value)} className="patients-search-input patients-input-md" />
            <input type="text" placeholder="Email..." value={emailFilter} onChange={e => setEmailFilter(e.target.value)} className="patients-search-input patients-input-md" />
            <input type="text" placeholder="Phone..." value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)} className="patients-search-input patients-input-sm" />
            <input type="text" placeholder="ID..." value={idFilter} onChange={e => setIdFilter(e.target.value)} className="patients-search-input patients-input-xs" />
            <input type="date" placeholder="Last Visit..." value={lastVisitFilter} onChange={e => setLastVisitFilter(e.target.value)} className="patients-search-input patients-input-md" />
            <input type="number" min="1" placeholder="Visits ≥..." value={visitCountFilter} onChange={e => setVisitCountFilter(e.target.value)} className="patients-search-input patients-input-count" />
            <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="patients-search-input patients-input-md">
              <option value="">All Doctors</option>
              {doctorList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="patients-toggle">
              <input type="checkbox" checked={chronicFilter} onChange={e => setChronicFilter(e.target.checked)} /> Chronic only
            </label>
            <button className="patients-add-btn" onClick={handleAdd}><EditIcon /> Add Patient</button>
          </div>

          <section className="patients-risk-section" ref={riskRef}>
            <div className="patients-section-title-row">
              <div>
                <span>Transparent operations model</span>
                <h3>Patient review cohorts</h3>
              </div>
              <small>{intelligence?.model?.id || 'preview-rules'} · non-diagnostic</small>
            </div>
            <div className="patients-risk-grid">
              <article>
                <span>High priority</span>
                <b>{riskCohorts.high.count}</b>
                <small>Avg {riskCohorts.high.avg} · confidence {riskCohorts.high.confidence || 0}%</small>
              </article>
              <article>
                <span>Medium priority</span>
                <b>{riskCohorts.medium.count}</b>
                <small>Avg {riskCohorts.medium.avg} · confidence {riskCohorts.medium.confidence || 0}%</small>
              </article>
              <article>
                <span>Low priority</span>
                <b>{riskCohorts.low.count}</b>
                <small>Avg {riskCohorts.low.avg} · confidence {riskCohorts.low.confidence || 0}%</small>
              </article>
            </div>
            <p className="patients-model-note"><FaShieldAlt aria-hidden="true" /> {intelligence?.model?.limitation || 'Operational prioritization only. A clinician must review every score before action.'}</p>
          </section>

          <section className="patients-data-fabric" aria-labelledby="health-data-fabric-title">
            <div className="patients-section-title-row">
              <div>
                <span>HealthTech architecture</span>
                <h3 id="health-data-fabric-title">Clinical data fabric</h3>
              </div>
              <small>SQL transaction core + document read model</small>
            </div>
            <div className="patients-data-fabric-grid">
              <article>
                <FaDatabase aria-hidden="true" />
                <span>Identity completeness</span>
                <b>{intelligence?.dataQuality?.identityCompleteness ?? 0}%</b>
                <small>Analytics consent: {intelligence?.dataQuality?.analyticsConsentCoverage ?? 0}% · identity fields governed</small>
              </article>
              <article>
                <FaExchangeAlt aria-hidden="true" />
                <span>FHIR event mirror</span>
                <b>{intelligence?.interoperability?.fhirReadModel?.connected ? 'LIVE' : 'READY'}</b>
                <small>{intelligence?.interoperability?.fhirReadModel?.documents ?? 0} privacy-minimized documents</small>
              </article>
              <article>
                <FaShieldAlt aria-hidden="true" />
                <span>Coded clinical records</span>
                <b>{intelligence?.dataQuality?.codedClinicalRecords ?? 0}</b>
                <small>{intelligence?.dataQuality?.terminologyValidatedRecords ?? 0} records matched to the ICD-10 registry</small>
              </article>
              <article>
                <FaDna aria-hidden="true" />
                <span>Molecular profiles</span>
                <b>{intelligence?.interoperability?.genomics?.profiles ?? 0}</b>
                <small>{intelligence?.interoperability?.genomics?.status === 'available' ? 'Governed omics data available' : 'Not loaded · never inferred'}</small>
              </article>
            </div>
          </section>

          <section className="patients-risk-section" ref={outreachRef}>
            <h3>Proactive Outreach Queue</h3>
            <div className="patients-table-wrapper">
              <table className="patients-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Patient</th>
                    <th>Risk Score</th>
                    <th>Confidence</th>
                    <th>Band</th>
                    <th>Last Visit</th>
                    <th>ETA</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outreachQueue.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No medium/high-risk patients in current cohort.</td>
                    </tr>
                  ) : outreachQueue.map((row) => (
                    <tr key={`outreach-${row.id}`}>
                      <td>{row.queueRank}</td>
                      <td>{row.name}</td>
                      <td>{row.riskScore}</td>
                      <td>{row.confidence ?? '—'}%</td>
                      <td><span className={`patient-badge ${row.riskBand === 'high' ? 'patient-badge-elderly' : 'patient-badge-chronic'}`}>{row.riskBand}</span></td>
                      <td>{row.lastVisit}</td>
                      <td>{row.etaHours}h</td>
                      <td>
                        <div className="patient-outreach-action">
                          <small>{row.outreachPriority}</small>
                          <button
                            type="button"
                            className={outreachLedger[row.id] ? 'is-complete' : ''}
                            onClick={() => handleOutreach(row)}
                            disabled={Boolean(outreachLedger[row.id])}
                          >
                            {outreachLedger[row.id] ? <><FaCheckCircle aria-hidden="true" /> Contacted</> : <><FaPhoneAlt aria-hidden="true" /> Start outreach</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="patients-table-wrapper" ref={tableRef}>
            <table className="patients-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Visits</th>
                  <th>Last Visit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPatients.map((p) => {
                  const history = getHistory(p);
                  const completedHistory = getCompletedHistory(p);
                  const lastVisit = completedHistory[0]?.date || '-';
                  // Badge logic
                  let badge = null;
                  if (p.warning && p.warning.toLowerCase().includes('chronic')) badge = <span className="patient-badge patient-badge-chronic">Chronic</span>;
                  else if (p.dob) {
                    const age = Math.floor((new Date().getTime() - new Date(p.dob).getTime())/3.15576e10);
                    if (age < 16) badge = <span className="patient-badge patient-badge-child">Child</span>;
                    else if (age > 65) badge = <span className="patient-badge patient-badge-elderly">Elderly</span>;
                  }
                  return (
                    <tr key={p.id} className="patients-row">
                      <td>{p.id}</td>
                      <td className="patients-name-cell" onClick={() => handleView(p)}>{p.name} {badge}</td>
                      <td>{p.email}</td>
                      <td>{p.phone}</td>
                      <td>{completedHistory.length}</td>
                      <td>{lastVisit}</td>
                      <td className="patients-actions-cell">
                        <button title="View Record" className="patients-btn patients-btn-view" onClick={() => handleView(p)}><DetailsIcon />View</button>
                        {history.length > 0 && (
                          <button title="Download PDF" className="patients-btn patients-btn-outline" onClick={() => handleDownload(p)}><EditIcon />PDF</button>
                        )}
                        <button title="Edit" className="patients-btn patients-btn-outline" onClick={() => handleEdit(p)}><EditIcon />Edit</button>
                        <button title="Delete" className="patients-btn patients-btn-danger" onClick={() => handleDelete(p)}><DeleteIcon />Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav className="patients-pagination" aria-label="Patient table pagination">
            <span>
              Showing {filteredRecent.length ? (tablePage - 1) * tablePageSize + 1 : 0}
              –{Math.min(tablePage * tablePageSize, filteredRecent.length)} of {filteredRecent.length}
            </span>
            <div>
              <button type="button" onClick={() => setTablePage((page) => Math.max(1, page - 1))} disabled={tablePage === 1}>Previous</button>
              <b>Page {tablePage} / {tablePageCount}</b>
              <button type="button" onClick={() => setTablePage((page) => Math.min(tablePageCount, page + 1))} disabled={tablePage === tablePageCount}>Next</button>
            </div>
          </nav>
          <div className="patients-features">
            <div className="patients-feature-block">
              <div className="patients-feature-title">Patient Management</div>
              <div className="patients-feature-desc">
                <ul>
                  <li>Centralized management of patient medical records by patient code.</li>
                  <li>View visit history, doctor, and re-exam schedule.</li>
                  <li>Download PDF copy of medical record (if available).</li>
                  <li>Data privacy: Only viewable by the patient (HIPAA-like).</li>
                </ul>
              </div>
            </div>
            <div className="patients-feature-block">
              <div className="patients-feature-title">Quick Actions</div>
              <div className="patients-feature-desc">
                <ul>
                  <li>Search for patients by name.</li>
                  <li>View and download medical records.</li>
                  <li>See visit count and last visit date.</li>
                </ul>
              </div>
            </div>
          </div>
          {modalPatient && (
            <PatientModal
              open={!!modalPatient}
              onClose={handleCloseModal}
              patient={modalPatient}
              history={modalHistory}
              onBook={handleBook}
              onEdit={() => { setEditPatient(modalPatient); setShowForm(true); setModalPatient(null); }}
              onDelete={() => { handleDelete(modalPatient); setModalPatient(null); }}
            />
          )}
          {showForm && (
            <PatientForm
              open={showForm}
              onClose={() => setShowForm(false)}
              onSave={handleSave}
              patient={editPatient}
            />
          )}
        </main>
      </div>
    </div>
  );
}
