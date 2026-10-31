import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  FaCheckCircle, FaDatabase, FaDna, FaFingerprint, FaFlask,
  FaLayerGroup, FaMicroscope, FaProjectDiagram, FaShieldAlt,
} from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { getBioinformaticsAtlasAPI } from '../services/bioinformatics';
import { formatDateTimeCompact } from '../utils/i18nFormat';
import './Common.css';
import './CareWorkspace.css';
import './Bioinformatics.css';

const CHART_COLOURS = ['#075b83', '#0a91ad', '#20bfd3', '#dda23d', '#d45d62'];

const questions = [
  {
    id: 'assay',
    label: 'Which assays dominate this cohort?',
    title: 'Assay diversity',
    description: 'Compare molecular assay volume before combining cohorts. A dominant assay can introduce platform and specimen bias.',
  },
  {
    id: 'gene',
    label: 'Which genes recur most often?',
    title: 'Gene observation catalogue',
    description: 'Counts describe this synthetic dataset only. Recurrence is not prevalence and is never a diagnosis or treatment recommendation.',
  },
  {
    id: 'build',
    label: 'Are genome builds harmonised?',
    title: 'Genome-build compatibility',
    description: 'GRCh37 and GRCh38 coordinates must not be joined directly. Liftover and post-conversion QC are required before cross-build analysis.',
  },
  {
    id: 'provenance',
    label: 'Can every result be reproduced?',
    title: 'Analysis provenance',
    description: 'Dataset, pipeline version, timestamps and checksum prefix make every aggregate analysis traceable and repeatable.',
  },
  {
    id: 'omics',
    label: 'How broad is the multi-omics evidence?',
    title: 'Multi-omics coverage',
    description: 'Genomics, epigenomics, transcriptomics, proteomics and metabolomics are kept as separate governed layers before any evidence synthesis.',
  },
  {
    id: 'consent',
    label: 'Is every profile consent-ready?',
    title: 'Purpose-scoped consent',
    description: 'Molecular metadata is included only when a current genomics consent decision is linked to the profile. Consent history remains append-only.',
  },
];

const PIPELINE_STAGES = [
  {
    id: 'consent', label: 'Consent scope', short: 'Purpose and access', icon: FaShieldAlt,
    description: 'Verify that the intended genomic use is covered by an active, purpose-scoped consent decision.',
  },
  {
    id: 'specimen', label: 'Specimen custody', short: 'Chain of custody', icon: FaFlask,
    description: 'Trace collection, accessioning, extraction and quality-control events without exposing direct identifiers.',
  },
  {
    id: 'assay', label: 'Assay processing', short: 'Molecular layers', icon: FaMicroscope,
    description: 'Keep genomics, epigenomics, transcriptomics, proteomics and metabolomics as governed evidence layers.',
  },
  {
    id: 'qc', label: 'Bioinformatics QC', short: 'Build and provenance', icon: FaProjectDiagram,
    description: 'Validate genome-build compatibility, pipeline version, checksum and reproducibility before interpretation.',
  },
  {
    id: 'report', label: 'Structured report', short: 'Clinical hand-off', icon: FaFingerprint,
    description: 'Package derived findings in a structured, reviewable report for clinician interpretation and audit.',
  },
];

const emptyAtlas = {
  overview: { profiles: 0, variantObservations: 0, genes: 0, assayTypes: 0, genomicsConsents: 0, multiOmicsLayers: 0, structuredReports: 0, specimenEvents: 0 },
  assayComposition: [], evidenceDistribution: [], geneCatalog: [], genomeBuilds: [], recentProfiles: [], workflows: [],
  multiOmicsComposition: [], specimenJourney: [],
  precisionReadiness: { structuredReports: 0, fhirReadyReports: 0, averageCompleteness: 0, consentCoverage: 0, longitudinalPatients: 0, specimenEvents: 0 },
  provenance: {},
};

const formatNumber = (value) => new Intl.NumberFormat('en-GB').format(Number(value || 0));

const AtlasTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bio-chart-tooltip">
      <b>{label || payload[0]?.name}</b>
      <span>{formatNumber(payload[0]?.value)} observations</span>
    </div>
  );
};

export default function Bioinformatics() {
  const [atlas, setAtlas] = useState(emptyAtlas);
  const [status, setStatus] = useState('loading');
  const [activeQuestion, setActiveQuestion] = useState('assay');
  const [activePipelineStage, setActivePipelineStage] = useState('specimen');

  useEffect(() => {
    let active = true;
    getBioinformaticsAtlasAPI()
      .then((data) => {
        if (!active) return;
        // Keep the workspace render-safe when an API adapter returns an empty
        // envelope or a partial response during an outage.
        setAtlas(data?.overview ? { ...emptyAtlas, ...data } : emptyAtlas);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setAtlas(emptyAtlas);
        setStatus('error');
      });
    return () => { active = false; };
  }, []);

  const selectedQuestion = questions.find((question) => question.id === activeQuestion) || questions[0];
  const leadingAssay = atlas.assayComposition?.[0];
  const topGene = atlas.geneCatalog?.[0];
  const buildSummary = atlas.genomeBuilds?.map((item) => `${item.label}: ${item.value}`).join(' · ');
  const readiness = atlas.precisionReadiness || emptyAtlas.precisionReadiness;
  const omicsCoverage = atlas.multiOmicsComposition || [];
  const maxOmicsProfiles = Math.max(1, ...omicsCoverage.map((item) => item.profiles || 0));
  const selectedPipelineStage = PIPELINE_STAGES.find((stage) => stage.id === activePipelineStage) || PIPELINE_STAGES[0];
  const SelectedPipelineIcon = selectedPipelineStage.icon;
  const pipelineMetrics = {
    consent: `${readiness.consentCoverage}% covered`,
    specimen: `${formatNumber(readiness.specimenEvents)} events`,
    assay: `${formatNumber(atlas.overview.multiOmicsLayers)} layers`,
    qc: `${formatNumber(atlas.workflows?.length)} runs`,
    report: `${formatNumber(readiness.fhirReadyReports)} ready`,
  };

  const evidenceData = useMemo(() => (
    [...(atlas.evidenceDistribution || [])]
      .sort((a, b) => b.value - a.value)
      .map((item) => ({ ...item, displayLabel: item.label.replaceAll('-', ' ') }))
  ), [atlas.evidenceDistribution]);

  const insight = activeQuestion === 'assay'
    ? `${leadingAssay?.label || 'No assay'} is the largest assay group (${formatNumber(leadingAssay?.value)} profiles).`
    : activeQuestion === 'gene'
      ? `${topGene?.gene || 'No gene'} has the highest observed recurrence (${formatNumber(topGene?.observations)} derived observations).`
      : activeQuestion === 'build'
        ? (buildSummary || 'No genome-build metadata is available.')
        : activeQuestion === 'provenance'
          ? `${formatNumber(atlas.workflows?.length)} versioned workflows are visible in the provenance ledger.`
          : activeQuestion === 'omics'
            ? `${formatNumber(omicsCoverage.length)} molecular layers cover ${formatNumber(omicsCoverage.reduce((sum, layer) => sum + layer.features, 0))} derived features.`
            : `${readiness.consentCoverage}% of profiled patients are linked to a purpose-scoped genomics consent decision.`;

  const modules = [
    { icon: <FaLayerGroup />, label: 'Cohort Atlas', value: atlas.overview.profiles, detail: 'Consent-scoped profiles' },
    { icon: <FaMicroscope />, label: 'Molecular Registry', value: atlas.overview.assayTypes, detail: 'Assay modalities' },
    { icon: <FaDna />, label: 'Variant Evidence', value: atlas.overview.variantObservations, detail: 'Derived observations' },
    { icon: <FaFingerprint />, label: 'Provenance Ledger', value: atlas.workflows?.length, detail: 'Versioned analysis runs' },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main id="main-content" tabIndex="-1" className="bio-content">
          <section className="bio-hero" aria-labelledby="bio-page-title">
            <div className="bio-hero-copy">
              <p className="bio-eyebrow"><FaDna aria-hidden="true" /> Precision biology workspace</p>
              <h1 id="bio-page-title">Bioinformatics <em>Atlas.</em></h1>
              <p>
                Explore consent-scoped molecular metadata, cohort composition and reproducible evidence
                without exposing raw sequence data.
              </p>
              <div className="bio-badge-row" aria-label="Dataset safeguards">
                <span><FaDatabase /> Synthetic SQL source</span>
                <span><FaShieldAlt /> Aggregate metadata only</span>
                <span><FaFlask /> Research demo · non-diagnostic</span>
              </div>
            </div>
            <div className="bio-hero-orbit" aria-hidden="true">
              <div className="bio-orbit bio-orbit-one" />
              <div className="bio-orbit bio-orbit-two" />
              <FaDna />
            </div>
          </section>

          {status === 'error' && (
            <div className="bio-state bio-state-error" role="alert">
              Bioinformatics SQL service is unavailable. No mock values were substituted.
            </div>
          )}
          {status === 'loading' && <div className="bio-state" role="status">Loading governed molecular evidence…</div>}

          <section className="bio-module-grid" aria-label="Bioinformatics ecosystem">
            {modules.map((module, index) => (
              <article className="bio-module-card" key={module.label} style={{ '--module-delay': `${index * 55}ms` }}>
                <div className="bio-module-icon" aria-hidden="true">{module.icon}</div>
                <div>
                  <span>{module.label}</span>
                  <strong>{formatNumber(module.value)}</strong>
                  <small>{module.detail}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="bio-question-panel">
            <div className="bio-section-heading">
              <div>
                <span className="bio-kicker">Question-led exploration</span>
                <h2>Start with a biological question</h2>
              </div>
              <span className="bio-source-pill"><FaCheckCircle /> {atlas.provenance?.datasetVersion || 'SQL dataset'}</span>
            </div>
            <div className="bio-question-chips" role="tablist" aria-label="Biological questions">
              {questions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  role="tab"
                  aria-selected={activeQuestion === question.id}
                  className={activeQuestion === question.id ? 'is-active' : ''}
                  onClick={() => setActiveQuestion(question.id)}
                >
                  {question.label}
                </button>
              ))}
            </div>
            <div className="bio-answer" role="tabpanel">
              <FaProjectDiagram aria-hidden="true" />
              <div><b>{selectedQuestion.title}</b><p>{selectedQuestion.description}</p><strong>{insight}</strong></div>
            </div>
          </section>

          <section className="bio-pipeline" aria-labelledby="bio-pipeline-title">
            <div className="bio-section-heading">
              <div>
                <span className="bio-kicker">Interactive evidence pipeline</span>
                <h2 id="bio-pipeline-title">From consent to clinical hand-off</h2>
                <p>Select a layer to understand how governed molecular evidence moves through the hospital.</p>
              </div>
              <span className="bio-source-pill"><FaCheckCircle aria-hidden="true" /> SQL-backed workflow</span>
            </div>

            <div className="bio-pipeline-layout">
              <div className="bio-layer-model" aria-hidden="true">
                <div className="bio-data-wave bio-data-wave-one" />
                <div className="bio-data-wave bio-data-wave-two" />
                {PIPELINE_STAGES.map((stage, index) => {
                  const Icon = stage.icon;
                  return (
                    <div
                      key={stage.id}
                      className={`bio-model-layer ${stage.id === activePipelineStage ? 'is-active' : ''}`}
                      style={{ '--layer-index': index }}
                    >
                      <Icon /><span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                  );
                })}
              </div>

              <div className="bio-pipeline-steps" role="tablist" aria-label="Molecular evidence workflow">
                {PIPELINE_STAGES.map((stage, index) => {
                  const Icon = stage.icon;
                  const active = stage.id === activePipelineStage;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      key={stage.id}
                      className={active ? 'is-active' : ''}
                      onClick={() => setActivePipelineStage(stage.id)}
                    >
                      <span className="bio-pipeline-index">{index + 1}</span>
                      <span className="bio-pipeline-icon"><Icon aria-hidden="true" /></span>
                      <span><b>{stage.label}</b><small>{stage.short}</small></span>
                      <strong>{pipelineMetrics[stage.id]}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bio-pipeline-answer" role="tabpanel">
              <SelectedPipelineIcon aria-hidden="true" />
              <div><span>{selectedPipelineStage.short}</span><b>{selectedPipelineStage.label}</b><p>{selectedPipelineStage.description}</p></div>
              <strong>{pipelineMetrics[selectedPipelineStage.id]}</strong>
            </div>
          </section>

          <section className="bio-precision-section" aria-labelledby="precision-readiness-title">
            <div className="bio-section-heading">
              <div>
                <span className="bio-kicker">Precision medicine command layer</span>
                <h2 id="precision-readiness-title">From specimen to governed evidence</h2>
                <p>Operational metadata for multi-omics research, structured reporting and longitudinal review.</p>
              </div>
              <span className="bio-source-pill"><FaShieldAlt /> Consent-scoped</span>
            </div>
            <div className="bio-readiness-grid">
              <article>
                <span>Consent coverage</span>
                <strong>{readiness.consentCoverage}%</strong>
                <small>Profiles linked to governed use</small>
              </article>
              <article>
                <span>FHIR-ready reports</span>
                <strong>{formatNumber(readiness.fhirReadyReports)}</strong>
                <small>{readiness.averageCompleteness}% average completeness</small>
              </article>
              <article>
                <span>Longitudinal cohorts</span>
                <strong>{formatNumber(readiness.longitudinalPatients)}</strong>
                <small>Patients with repeat molecular profiles</small>
              </article>
              <article>
                <span>Specimen events</span>
                <strong>{formatNumber(readiness.specimenEvents)}</strong>
                <small>Traceable laboratory transitions</small>
              </article>
            </div>
          </section>

          <section className="bio-precision-grid">
            <article className={`bio-panel ${activeQuestion === 'omics' ? 'is-focused' : ''}`}>
              <div className="bio-panel-head">
                <div><span className="bio-kicker">Molecular evidence fusion</span><h2>Multi-omics coverage</h2></div>
                <span>{formatNumber(atlas.overview.multiOmicsLayers)} layers</span>
              </div>
              <div className="bio-omics-list">
                {omicsCoverage.map((layer, index) => (
                  <div className="bio-omics-row" key={layer.label}>
                    <div className="bio-omics-label">
                      <b>{layer.label}</b>
                      <span>{formatNumber(layer.features)} derived features</span>
                    </div>
                    <div className="bio-omics-track" aria-label={`${layer.profiles} profiles in ${layer.label}`}>
                      <i style={{ width: `${(layer.profiles / maxOmicsProfiles) * 100}%`, background: CHART_COLOURS[index % CHART_COLOURS.length] }} />
                    </div>
                    <strong>{formatNumber(layer.profiles)}</strong>
                  </div>
                ))}
                {!omicsCoverage.length && <p className="bio-empty">No governed omics summaries available.</p>}
              </div>
              <p className="bio-chart-note">Layer counts are quality-controlled synthetic metadata. They are not population prevalence estimates.</p>
            </article>

            <article className="bio-panel">
              <div className="bio-panel-head">
                <div><span className="bio-kicker">Chain of custody</span><h2>Specimen journey</h2></div>
                <span>{formatNumber(readiness.specimenEvents)} events</span>
              </div>
              <ol className="bio-journey-list">
                {(atlas.specimenJourney || []).map((stage, index) => (
                  <li key={stage.stage}>
                    <span className="bio-journey-index">{String(index + 1).padStart(2, '0')}</span>
                    <div><b>{stage.stage.replaceAll('-', ' ')}</b><small>{formatNumber(stage.healthyEvents)} quality-cleared events</small></div>
                    <strong>{formatNumber(stage.events)}</strong>
                  </li>
                ))}
              </ol>
            </article>
          </section>

          <section className="bio-visual-grid">
            <article className={`bio-panel ${activeQuestion === 'assay' ? 'is-focused' : ''}`}>
              <div className="bio-panel-head">
                <div><span className="bio-kicker">Cohort composition</span><h2>Assay mix</h2></div>
                <span>{formatNumber(atlas.overview.profiles)} profiles</span>
              </div>
              <div className="bio-donut-layout">
                <div className="bio-chart" role="img" aria-label="Donut chart of molecular profiles by assay type">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={atlas.assayComposition} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="84%" paddingAngle={3} stroke="none">
                        {atlas.assayComposition.map((item, index) => <Cell key={item.label} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />)}
                      </Pie>
                      <Tooltip content={<AtlasTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="bio-donut-center"><b>{formatNumber(atlas.overview.assayTypes)}</b><span>assays</span></div>
                </div>
                <ul className="bio-legend">
                  {atlas.assayComposition.map((item, index) => (
                    <li key={item.label}><i style={{ background: CHART_COLOURS[index % CHART_COLOURS.length] }} /><span>{item.label}</span><b>{item.value}</b></li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="bio-panel">
              <div className="bio-panel-head">
                <div><span className="bio-kicker">Evidence distribution</span><h2>Five-tier classification</h2></div>
                <span>Derived metadata</span>
              </div>
              <div className="bio-bar-chart" role="img" aria-label="Horizontal bar chart of synthetic evidence classifications">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evidenceData} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
                    <CartesianGrid horizontal={false} stroke="#dce2d7" strokeDasharray="3 5" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="displayLabel" width={110} tickLine={false} axisLine={false} />
                    <Tooltip content={<AtlasTooltip />} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={19}>
                      {evidenceData.map((item, index) => <Cell key={item.label} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="bio-chart-note">Classifications are synthetic teaching labels, not ClinVar assertions.</p>
            </article>
          </section>

          <section className={`bio-panel bio-gene-panel ${activeQuestion === 'gene' ? 'is-focused' : ''}`}>
            <div className="bio-panel-head">
              <div><span className="bio-kicker">Searchable evidence catalogue</span><h2>Gene observation matrix</h2></div>
              <span>{formatNumber(atlas.overview.genes)} genes</span>
            </div>
            <div className="bio-table-wrap">
              <table className="bio-table">
                <thead><tr><th>Gene</th><th>Observations</th><th>Relative volume</th><th>Avg. allele fraction</th><th>Curated demo signals</th></tr></thead>
                <tbody>
                  {atlas.geneCatalog.map((row) => (
                    <tr key={row.gene}>
                      <td><b className="bio-gene-symbol">{row.gene}</b></td>
                      <td>{formatNumber(row.observations)}</td>
                      <td><div className="bio-meter"><i style={{ width: `${Math.min(100, (row.observations / Math.max(1, topGene?.observations || 1)) * 100)}%` }} /></div></td>
                      <td>{Math.round(row.averageAlleleFraction * 100)}%</td>
                      <td><span className="bio-signal-pill">{row.curatedSignals}</span></td>
                    </tr>
                  ))}
                  {!atlas.geneCatalog.length && <tr><td colSpan="5" className="bio-empty">No governed observations available.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bio-bottom-grid">
            <article className={`bio-panel ${activeQuestion === 'provenance' ? 'is-focused' : ''}`}>
              <div className="bio-panel-head">
                <div><span className="bio-kicker">Reproducible by design</span><h2>Analysis provenance</h2></div>
                <FaFingerprint aria-hidden="true" />
              </div>
              <ol className="bio-run-list">
                {atlas.workflows.map((run) => (
                  <li key={run.id}>
                    <span className="bio-run-status"><FaCheckCircle /></span>
                    <div><b>{run.analysisType.replaceAll('-', ' ')}</b><small>{run.datasetVersion} · pipeline {run.pipelineVersion}</small></div>
                    <code>{run.checksumPrefix}…</code>
                    <time>{run.completedAt ? formatDateTimeCompact(run.completedAt) : 'In progress'}</time>
                  </li>
                ))}
              </ol>
            </article>

            <article className={`bio-panel ${activeQuestion === 'build' ? 'is-focused' : ''}`}>
              <div className="bio-panel-head">
                <div><span className="bio-kicker">Interoperability QC</span><h2>Genome builds</h2></div>
                <FaDatabase aria-hidden="true" />
              </div>
              <div className="bio-build-list">
                {atlas.genomeBuilds.map((build, index) => (
                  <div key={build.label}>
                    <span>{build.label}</span><b>{build.value} profiles</b>
                    <div><i style={{ width: `${(build.value / Math.max(1, atlas.overview.profiles)) * 100}%`, background: CHART_COLOURS[index] }} /></div>
                  </div>
                ))}
              </div>
              <div className="bio-governance-note">
                <FaShieldAlt aria-hidden="true" />
                <p><b>Safe analytical boundary</b>Raw sequences are not stored. Coordinates from different genome builds require harmonisation before comparison.</p>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
