import { useState } from 'react';
import {
  FaArrowRight,
  FaCalendarAlt,
  FaClipboardCheck,
  FaClipboardList,
  FaFileInvoiceDollar,
  FaHeartbeat,
  FaMicroscope,
  FaPills,
  FaProcedures,
  FaStethoscope,
  FaUserPlus,
  FaVials,
} from 'react-icons/fa';
import { ROUTES } from '../../../constants';

export default function HospitalOperatingModel({ kpi, navigate }) {
  const stages = [
    {
      id: 'intake', label: 'Patient intake', eyebrow: 'Front desk', icon: FaUserPlus,
      count: Math.max(1, kpi.today + 4), eta: '03 min', route: ROUTES.PATIENTS,
      description: 'Register identity, consent, insurance and the reason for visit in one governed record.',
      action: 'Open patient registry',
    },
    {
      id: 'triage', label: 'Clinical triage', eyebrow: 'Nursing station', icon: FaHeartbeat,
      count: Math.max(0, kpi.waiting + 2), eta: '08 min', route: ROUTES.INNOVATION_LAB,
      description: 'Capture vital signs, acuity and red flags before routing the patient to the right care team.',
      action: 'Open triage workspace',
    },
    {
      id: 'encounter', label: 'Consultation', eyebrow: 'Care team', icon: FaStethoscope,
      count: Math.max(1, kpi.today - kpi.completed + 1), eta: '18 min', route: ROUTES.MEDICAL_RECORDS,
      description: 'Review longitudinal history, document the encounter and maintain ICD-coded clinical context.',
      action: 'Open clinical record',
    },
    {
      id: 'orders', label: 'Orders & diagnostics', eyebrow: 'Lab / imaging', icon: FaVials,
      count: Math.max(1, Math.round(kpi.today * 0.42)), eta: '26 min', route: ROUTES.MEDICAL_RECORDS,
      description: 'Coordinate laboratory and imaging requests with specimen traceability and result review.',
      action: 'Review diagnostics',
    },
    {
      id: 'medication', label: 'Medication', eyebrow: 'Pharmacy', icon: FaPills,
      count: Math.max(1, kpi.completed), eta: '07 min', route: ROUTES.MEDICAL_RECORDS,
      description: 'Prepare medication counselling, prescriptions and the treatment plan for a safe hand-off.',
      action: 'Review care plan',
    },
    {
      id: 'discharge', label: 'Discharge & follow-up', eyebrow: 'Care continuity', icon: FaClipboardCheck,
      count: Math.max(0, kpi.completed), eta: '05 min', route: ROUTES.NOTIFICATIONS,
      description: 'Close the care loop with discharge instructions, reminders and the next appointment.',
      action: 'Coordinate follow-up',
    },
  ];
  const [activeStage, setActiveStage] = useState(stages[1].id);
  const selected = stages.find((stage) => stage.id === activeStage) || stages[0];
  const SelectedIcon = selected.icon;
  const workspaces = [
    { icon: FaUserPlus, label: 'Patient registration', meta: 'Identity · consent · coverage', route: ROUTES.PATIENTS },
    { icon: FaCalendarAlt, label: 'Appointments', meta: 'Booking · queue · reminders', route: ROUTES.APPOINTMENTS },
    { icon: FaProcedures, label: 'Clinical records', meta: 'Encounters · ICD-10 · history', route: ROUTES.MEDICAL_RECORDS },
    { icon: FaMicroscope, label: 'Precision medicine', meta: 'Specimen · omics · provenance', route: ROUTES.BIOINFORMATICS },
    { icon: FaFileInvoiceDollar, label: 'Operations reports', meta: 'Capacity · quality · finance', route: ROUTES.REPORTS },
    { icon: FaClipboardList, label: 'Care communication', meta: 'Inbox · retry · follow-up', route: ROUTES.NOTIFICATIONS },
  ];

  return (
    <section className="care-os" aria-labelledby="care-os-title">
      <div className="care-os-heading">
        <div>
          <span className="care-os-kicker">Hospital operating model</span>
          <h2 id="care-os-title">One patient journey. Every team connected.</h2>
          <p>Select a stage to inspect the work queue and continue directly in the responsible workspace.</p>
        </div>
        <span className="care-os-status"><i /> Care pathway live</span>
      </div>

      <div className="care-pathway-shell">
        <div className="care-pathway" role="tablist" aria-label="Patient care pathway">
          <div className="care-pathway-line" aria-hidden="true"><i /></div>
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const active = stage.id === selected.id;
            return (
              <button key={stage.id} type="button" role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={() => setActiveStage(stage.id)}>
                <span className="care-stage-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="care-stage-icon"><Icon aria-hidden="true" /></span>
                <span className="care-stage-copy"><b>{stage.label}</b><small>{stage.eyebrow}</small></span>
                <span className="care-stage-count">{stage.count}</span>
              </button>
            );
          })}
        </div>

        <article className="care-stage-detail" role="tabpanel">
          <div className="care-stage-illustration" aria-hidden="true">
            <div className="care-model-stack">
              <span className="care-model-layer care-model-layer-one" />
              <span className="care-model-layer care-model-layer-two" />
              <span className="care-model-layer care-model-layer-three" />
              <i className="care-model-signal care-model-signal-one" />
              <i className="care-model-signal care-model-signal-two" />
            </div>
            <div className="care-pulse-ring care-pulse-ring-one" />
            <div className="care-pulse-ring care-pulse-ring-two" />
            <span className="care-model-icon"><SelectedIcon /></span>
          </div>
          <div className="care-stage-detail-copy">
            <span>{selected.eyebrow}</span>
            <h3>{selected.label}</h3>
            <p>{selected.description}</p>
            <div className="care-stage-metrics">
              <div><small>Active queue</small><b>{selected.count} patients</b></div>
              <div><small>Estimated hand-off</small><b>{selected.eta}</b></div>
            </div>
            <button type="button" onClick={() => navigate(`/${selected.route}`)}>
              {selected.action} <FaArrowRight aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>

      <div className="care-workspace-grid" aria-label="Hospital management workspaces">
        {workspaces.map(({ icon, label, meta, route }) => {
          const WorkspaceIcon = icon;
          return (
            <button type="button" key={label} onClick={() => navigate(`/${route}`)}>
              <span><WorkspaceIcon aria-hidden="true" /></span>
              <span><b>{label}</b><small>{meta}</small></span>
              <FaArrowRight aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
