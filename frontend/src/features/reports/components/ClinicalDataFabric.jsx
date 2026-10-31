import {
  FaBolt,
  FaDatabase,
  FaFileMedical,
  FaMicroscope,
  FaProjectDiagram,
} from 'react-icons/fa';

export default function ClinicalDataFabric() {
  return (
    <section className="reports-data-fabric" aria-labelledby="clinical-data-fabric-title">
      <div className="reports-fabric-copy">
        <span className="care-eyebrow"><FaMicroscope aria-hidden="true" /> Research-ready architecture</span>
        <h3 id="clinical-data-fabric-title">Clinical data fabric</h3>
        <p>Each store has one clear job. Identifiable operational records stay governed in SQL; privacy-minimized clinical events become flexible MongoDB read models; Redis accelerates short-lived operational views.</p>
        <div className="reports-fabric-standards"><span>FHIR-inspired events</span><span>Transactional outbox</span><span>Provenance retained</span></div>
      </div>
      <div className="reports-fabric-model" role="img" aria-label="Architecture model showing SQL Server publishing governed clinical events through an outbox to MongoDB and Redis, then into care intelligence">
        <div className="reports-fabric-core"><FaFileMedical aria-hidden="true" /><b>Care intelligence</b><small>Decision layer</small></div>
        <div className="reports-fabric-orbit reports-fabric-orbit-one" aria-hidden="true" />
        <div className="reports-fabric-orbit reports-fabric-orbit-two" aria-hidden="true" />
        <div className="reports-fabric-node node-sql"><FaDatabase aria-hidden="true" /><b>SQL Server</b><small>Source of truth</small></div>
        <div className="reports-fabric-node node-mongo"><FaProjectDiagram aria-hidden="true" /><b>MongoDB</b><small>Clinical events</small></div>
        <div className="reports-fabric-node node-redis"><FaBolt aria-hidden="true" /><b>Redis</b><small>Live cache</small></div>
      </div>
    </section>
  );
}
