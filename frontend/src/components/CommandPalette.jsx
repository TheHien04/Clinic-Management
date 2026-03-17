import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import './CommandPalette.css';

const RECENT_COMMANDS_KEY = 'command_palette_recent_v1';
const RECENT_COMMANDS_LIMIT = 6;

const routeCommands = [
  { id: 'go-dashboard', title: 'Go to Dashboard', route: ROUTES.DASHBOARD, keywords: 'home overview main', category: 'Navigation' },
  { id: 'go-appointments', title: 'Go to Appointments', route: ROUTES.APPOINTMENTS, keywords: 'book schedule visit', category: 'Navigation' },
  { id: 'go-patients', title: 'Go to Patients', route: ROUTES.PATIENTS, keywords: 'records people profile', category: 'Navigation' },
  { id: 'go-doctors', title: 'Go to Doctors', route: ROUTES.DOCTORS, keywords: 'physician staffing roster', category: 'Navigation' },
  { id: 'go-reports', title: 'Go to Reports', route: ROUTES.REPORTS, keywords: 'analytics kpi trend', category: 'Navigation' },
  { id: 'go-medical-records', title: 'Go to Medical Records', route: ROUTES.MEDICAL_RECORDS, keywords: 'diagnosis followup history', category: 'Navigation' },
];

const fuzzySubsequenceScore = (text, pattern) => {
  let score = 0;
  let index = 0;

  for (let i = 0; i < text.length && index < pattern.length; i += 1) {
    if (text[i] === pattern[index]) {
      score += 2;
      if (index > 0 && text[i - 1] === pattern[index - 1]) score += 1;
      index += 1;
    }
  }

  return index === pattern.length ? score : 0;
};

const scoreCommand = (command, keyword) => {
  if (!keyword) return 1;

  const title = command.title.toLowerCase();
  const subtitle = command.subtitle.toLowerCase();
  const keywords = command.keywords.toLowerCase();
  const haystack = `${title} ${subtitle} ${keywords}`;

  if (!haystack.includes(keyword) && !fuzzySubsequenceScore(haystack, keyword)) return 0;

  let score = fuzzySubsequenceScore(title, keyword) + fuzzySubsequenceScore(keywords, keyword);

  if (title === keyword) score += 1000;
  if (title.startsWith(keyword)) score += 500;
  if (keywords.startsWith(keyword)) score += 300;
  if (subtitle.includes(keyword)) score += 150;
  if (haystack.includes(keyword)) score += 120;

  return score;
};

const isEditableTarget = (target) => {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

export default function CommandPalette({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const currentRoute = location.pathname.replace(/^\//, '') || ROUTES.DASHBOARD;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) {
        setRecentCommandIds(parsed.slice(0, RECENT_COMMANDS_LIMIT));
      }
    } catch {
      setRecentCommandIds([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(recentCommandIds));
  }, [recentCommandIds]);

  const commands = useMemo(() => {
    const runPageAction = (route, eventName, action) => {
      if (currentRoute === route) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: { action } }));
      } else {
        navigate(`/${route}?cp_action=${action}`);
      }
    };

    const runReportsAction = (action) => {
      runPageAction(ROUTES.REPORTS, 'reports:command', action);
    };

    const runAppointmentsAction = (action) => {
      runPageAction(ROUTES.APPOINTMENTS, 'appointments:command', action);
    };

    const runDashboardAction = (action) => {
      runPageAction(ROUTES.DASHBOARD, 'dashboard:command', action);
    };

    const runPatientsAction = (action) => {
      runPageAction(ROUTES.PATIENTS, 'patients:command', action);
    };

    const runDoctorsAction = (action) => {
      runPageAction(ROUTES.DOCTORS, 'doctors:command', action);
    };

    const runMedicalRecordsAction = (action) => {
      runPageAction(ROUTES.MEDICAL_RECORDS, 'medical-records:command', action);
    };

    const baseCommands = routeCommands.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: `/${item.route}`,
      keywords: item.keywords,
      category: item.category,
      run: () => navigate(`/${item.route}`),
    }));

    baseCommands.push(
      {
        id: 'reports-last30',
        title: 'Reports: Apply Last 30 Days',
        subtitle: 'Quick filter reports to last 30 days',
        keywords: 'reports filter 30 days recent',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('last30'),
      },
      {
        id: 'reports-last90',
        title: 'Reports: Apply Last 90 Days',
        subtitle: 'Quick filter reports to last 90 days',
        keywords: 'reports filter 90 days quarter',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('last90'),
      },
      {
        id: 'reports-export',
        title: 'Reports: Export CSV',
        subtitle: 'Export report table as CSV',
        keywords: 'reports csv download export',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('export'),
      },
      {
        id: 'reports-copilot',
        title: 'Reports: Focus AI Copilot',
        subtitle: 'Jump and focus copilot input',
        keywords: 'reports ai copilot question ask',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('copilot'),
      },
      {
        id: 'reports-simulator',
        title: 'Reports: Open What-if Simulator',
        subtitle: 'Jump to revenue simulator section',
        keywords: 'reports simulator forecast what if',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('simulator'),
      },
      {
        id: 'reports-alerts',
        title: 'Reports: Open Alert Center',
        subtitle: 'Jump to smart alert center',
        keywords: 'reports alerts threshold risk',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('alerts'),
      },
      {
        id: 'reports-quality',
        title: 'Reports: Open Data Quality Lab',
        subtitle: 'Jump to trust score and data integrity checks',
        keywords: 'reports quality trust score dq data',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('quality'),
      },
      {
        id: 'reports-playbook',
        title: 'Reports: Open Autonomous Playbook',
        subtitle: 'Jump to recommended operational actions',
        keywords: 'reports playbook actions optimization ops',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('playbook'),
      },
      {
        id: 'reports-twin',
        title: 'Reports: Open Digital Twin Lab',
        subtitle: 'Jump to capacity simulation controls',
        keywords: 'reports digital twin capacity simulation',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('twin'),
      },
      {
        id: 'reports-autopilot',
        title: 'Reports: Run Autopilot Optimization',
        subtitle: 'Auto apply optimization-focused filters and thresholds',
        keywords: 'reports autopilot optimize ai dr alias',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('autopilot'),
      },
      {
        id: 'reports-scheduler',
        title: 'Reports: Open Auto-Scheduler',
        subtitle: 'Jump to doctor schedule recommendations',
        keywords: 'reports scheduler slot staffing',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('scheduler'),
      },
      {
        id: 'reports-trajectory',
        title: 'Reports: Open Risk Trajectory',
        subtitle: 'Jump to patient risk trend view',
        keywords: 'reports trajectory risk trend patients',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('trajectory'),
      },
      {
        id: 'reports-precision',
        title: 'Reports: Open Precision Risk Twin',
        subtitle: 'Jump to patient-level precision risk recommendations',
        keywords: 'reports precision risk twin patient intervention',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('precision'),
      },
      {
        id: 'reports-rpm',
        title: 'Reports: Open Remote Monitoring Center',
        subtitle: 'Jump to RPM telemetry and alert board',
        keywords: 'reports rpm remote monitoring telemetry alerts',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('rpm'),
      },
      {
        id: 'reports-pathway',
        title: 'Reports: Open Pathway Orchestrator',
        subtitle: 'Jump to clinical pathway maturity board',
        keywords: 'reports pathway orchestrator clinical automation',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('pathway'),
      },
      {
        id: 'reports-subscription',
        title: 'Reports: Open FHIR Subscription Feed',
        subtitle: 'Jump to realtime FHIR event stream section',
        keywords: 'reports fhir subscription live feed events',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('subscription'),
      },
      {
        id: 'reports-fhir-event-export',
        title: 'Reports: Export FHIR Event Log',
        subtitle: 'Download FHIR subscription events in NDJSON format',
        keywords: 'reports fhir event export ndjson siem',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('fhir-event-export'),
      },
      {
        id: 'reports-fhir-replay-toggle',
        title: 'Reports: Toggle FHIR Feed Replay',
        subtitle: 'Start or pause live event replay simulation',
        keywords: 'reports fhir replay simulation timeline',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('fhir-replay-toggle'),
      },
      {
        id: 'reports-fhir-replay-reset',
        title: 'Reports: Reset FHIR Feed Replay',
        subtitle: 'Reset replay cursor to full live feed mode',
        keywords: 'reports fhir replay reset cursor',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('fhir-replay-reset'),
      },
      {
        id: 'reports-dtx',
        title: 'Reports: Open Digital Therapeutics Coach',
        subtitle: 'Jump to DTx adherence and protocol coach board',
        keywords: 'reports dtx digital therapeutics adherence coach',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx'),
      },
      {
        id: 'reports-dtx-apply-rules',
        title: 'Reports: Apply DTx Rules',
        subtitle: 'Validate and apply DTx JSON rules engine policy',
        keywords: 'reports dtx rules engine apply json policy',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-apply-rules'),
      },
      {
        id: 'reports-dtx-export-policy',
        title: 'Reports: Export DTx Policy JSON',
        subtitle: 'Download current DTx policy as JSON for governance',
        keywords: 'reports dtx export policy json governance',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-export-policy'),
      },
      {
        id: 'reports-dtx-import-policy',
        title: 'Reports: Import DTx Policy JSON',
        subtitle: 'Load a previously approved DTx policy version',
        keywords: 'reports dtx import policy json approved',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-import-policy'),
      },
      {
        id: 'reports-dtx-reset-policy',
        title: 'Reports: Reset DTx Policy Default',
        subtitle: 'Rollback DTx rules to baseline default policy',
        keywords: 'reports dtx reset rollback default policy',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-reset-policy'),
      },
      {
        id: 'reports-dtx-sign-bundle',
        title: 'Reports: Export Signed DTx Bundle',
        subtitle: 'Sign and download DTx policy governance bundle',
        keywords: 'reports dtx signed bundle export governance',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-sign-bundle'),
      },
      {
        id: 'reports-dtx-verify-bundle',
        title: 'Reports: Verify Signed DTx Bundle',
        subtitle: 'Import and verify signed DTx governance bundle',
        keywords: 'reports dtx verify bundle signature',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-verify-bundle'),
      },
      {
        id: 'reports-dtx-diff',
        title: 'Reports: Open DTx Policy Diff Viewer',
        subtitle: 'Jump to baseline-vs-current DTx policy comparison',
        keywords: 'reports dtx policy diff compare baseline',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-diff'),
      },
      {
        id: 'reports-dtx-governance-audit',
        title: 'Reports: Open DTx Governance Audit',
        subtitle: 'Jump to DTx governance action trail',
        keywords: 'reports dtx governance audit trail',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-governance-audit'),
      },
      {
        id: 'reports-dtx-mark-reviewed',
        title: 'Reports: Mark DTx Policy Reviewed',
        subtitle: 'Update DTx governance state to Reviewed',
        keywords: 'reports dtx reviewed governance status',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-mark-reviewed'),
      },
      {
        id: 'reports-dtx-mark-approved',
        title: 'Reports: Mark DTx Policy Approved',
        subtitle: 'Update DTx governance state to Approved',
        keywords: 'reports dtx approved governance status',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('dtx-mark-approved'),
      },
      {
        id: 'reports-population',
        title: 'Reports: Open Population Health Stratification',
        subtitle: 'Jump to cohort stratification and outreach queue',
        keywords: 'reports population health cohort stratification outreach',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('population'),
      },
      {
        id: 'reports-population-export-outreach',
        title: 'Reports: Export Outreach Plan CSV',
        subtitle: 'Download prioritized outreach queue as CSV',
        keywords: 'reports outreach export csv population queue',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('population-export-outreach'),
      },
      {
        id: 'reports-population-sla',
        title: 'Reports: Open Outreach SLA Radar',
        subtitle: 'Jump to SLA breach forecast for outreach queues',
        keywords: 'reports population sla breach outreach radar',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('population-sla'),
      },
      {
        id: 'reports-population-rebalance',
        title: 'Reports: Apply Outreach Auto-Rebalance',
        subtitle: 'Auto-tune staffing and urgent slots using SLA forecast',
        keywords: 'reports population rebalance outreach staffing sla',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('population-rebalance'),
      },
      {
        id: 'reports-population-rebalance-preview',
        title: 'Reports: Preview Outreach Rebalance',
        subtitle: 'Preview staffing changes before applying rebalance',
        keywords: 'reports population rebalance preview staffing',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('population-rebalance-preview'),
      },
      {
        id: 'reports-population-rebalance-rollback',
        title: 'Reports: Rollback Outreach Rebalance',
        subtitle: 'Restore previous outreach staffing configuration',
        keywords: 'reports population rebalance rollback restore',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('population-rebalance-rollback'),
      },
      {
        id: 'reports-benchmark',
        title: 'Reports: Open Benchmark Board',
        subtitle: 'Jump to multi-clinic benchmark analytics',
        keywords: 'reports benchmark clinics leaderboard',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('benchmark'),
      },
      {
        id: 'reports-executive',
        title: 'Reports: Open Executive Center',
        subtitle: 'Jump to executive command center snapshot',
        keywords: 'reports executive board command center',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('executive'),
      },
      {
        id: 'reports-scenarios',
        title: 'Reports: Open Scenario Library',
        subtitle: 'Jump to one-click strategy scenarios',
        keywords: 'reports scenarios strategy runner',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('scenarios'),
      },
      {
        id: 'reports-scenario-growth',
        title: 'Reports: Run Growth Scenario',
        subtitle: 'Apply growth acceleration strategy',
        keywords: 'reports scenario growth run',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('scenario-growth'),
      },
      {
        id: 'reports-scenario-retention',
        title: 'Reports: Run Retention Scenario',
        subtitle: 'Apply retention rescue strategy',
        keywords: 'reports scenario retention run',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('scenario-retention'),
      },
      {
        id: 'reports-scenario-efficiency',
        title: 'Reports: Run Efficiency Scenario',
        subtitle: 'Apply efficiency maximizer strategy',
        keywords: 'reports scenario efficiency run',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('scenario-efficiency'),
      },
      {
        id: 'reports-board-export',
        title: 'Reports: Export Executive Board',
        subtitle: 'Download executive snapshot as CSV',
        keywords: 'reports board export executive csv',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('board-export'),
      },
      {
        id: 'reports-compare',
        title: 'Reports: Open Scenario Comparison',
        subtitle: 'Jump to strategy comparison matrix',
        keywords: 'reports compare scenarios matrix',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('compare'),
      },
      {
        id: 'reports-briefing',
        title: 'Reports: Open AI Briefing',
        subtitle: 'Jump to executive AI briefing lines',
        keywords: 'reports briefing ai summary executive',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('briefing'),
      },
      {
        id: 'reports-delta',
        title: 'Reports: Open Delta Tracker',
        subtitle: 'Jump to scenario run history and deltas',
        keywords: 'reports delta tracker scenario history',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('delta'),
      },
      {
        id: 'reports-weekly',
        title: 'Reports: Open Weekly Briefing',
        subtitle: 'Jump to weekly briefing template',
        keywords: 'reports weekly template briefing',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('weekly'),
      },
      {
        id: 'reports-print-executive',
        title: 'Reports: Print Executive Page',
        subtitle: 'Open print dialog for executive report page',
        keywords: 'reports print executive page',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('print-executive'),
      },
      {
        id: 'reports-drift',
        title: 'Reports: Open Drift Alerts',
        subtitle: 'Jump to scenario drift alert tracker',
        keywords: 'reports drift alert scenario',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('drift'),
      },
      {
        id: 'reports-weekly-pack',
        title: 'Reports: Export Weekly Pack',
        subtitle: 'Download weekly briefing pack as CSV',
        keywords: 'reports weekly pack export',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('weekly-pack'),
      },
      {
        id: 'reports-monday-briefing',
        title: 'Reports: Run Auto Monday Briefing',
        subtitle: 'Set previous week range and export weekly pack',
        keywords: 'reports monday briefing auto',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('monday-briefing'),
      },
      {
        id: 'reports-copy-brief',
        title: 'Reports: Copy Auto-Brief',
        subtitle: 'Copy executive brief to clipboard',
        keywords: 'reports copy brief slack email',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('copy-brief'),
      },
      {
        id: 'reports-email-html',
        title: 'Reports: Generate Executive Email HTML',
        subtitle: 'Create downloadable HTML email from weekly briefing',
        keywords: 'reports email html executive briefing template',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('email-html'),
      },
      {
        id: 'reports-mailto-brief',
        title: 'Reports: Send Brief via Email',
        subtitle: 'Open default mail client with prefilled executive brief',
        keywords: 'reports email mailto send brief share',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('mailto-brief'),
      },
      {
        id: 'reports-mailto-brief-leadership',
        title: 'Reports: Email Brief to Leadership',
        subtitle: 'Prefill recipients for CEO/COO/Ops leadership board',
        keywords: 'reports email leadership ceo coo ops',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('mailto-brief-leadership'),
      },
      {
        id: 'reports-mailto-brief-operations',
        title: 'Reports: Email Brief to Operations',
        subtitle: 'Prefill recipients for operations and scheduler board',
        keywords: 'reports email operations scheduler quality',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('mailto-brief-operations'),
      },
      {
        id: 'reports-mailto-brief-finance',
        title: 'Reports: Email Brief to Finance',
        subtitle: 'Prefill recipients for finance and strategy board',
        keywords: 'reports email finance strategy controller',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('mailto-brief-finance'),
      },
      {
        id: 'reports-compliance',
        title: 'Reports: Open Compliance Cockpit',
        subtitle: 'Jump to HIPAA/GDPR/ISO control board',
        keywords: 'reports compliance hipaa gdpr iso security governance',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('compliance'),
      },
      {
        id: 'reports-fhir-export',
        title: 'Reports: Export FHIR Bundle',
        subtitle: 'Download HL7 FHIR R4 bundle (JSON)',
        keywords: 'reports fhir hl7 interoperability export bundle',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('fhir-export'),
      },
      {
        id: 'reports-integrity-hash',
        title: 'Reports: Generate Integrity Hash',
        subtitle: 'Create SHA-256 board package fingerprint',
        keywords: 'reports sha256 integrity hash signature package',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('integrity-hash'),
      },
      {
        id: 'reports-package-sign',
        title: 'Reports: Sign Executive Package',
        subtitle: 'Digitally sign package using ECDSA P-256',
        keywords: 'reports sign signature ecdsa package security',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('package-sign'),
      },
      {
        id: 'reports-package-verify',
        title: 'Reports: Verify Package Signature',
        subtitle: 'Verify signature integrity using embedded public key',
        keywords: 'reports verify signature integrity ecdsa public key',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('package-verify'),
      },
      {
        id: 'reports-signed-package-export',
        title: 'Reports: Export Signed Package JSON',
        subtitle: 'Download signed package for external audit verification',
        keywords: 'reports export signed package json audit verify',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('signed-package-export'),
      },
      {
        id: 'reports-package-tamper',
        title: 'Reports: Simulate Package Tamper',
        subtitle: 'Modify payload intentionally to test signature failure',
        keywords: 'reports tamper simulate payload signature fail demo',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('package-tamper'),
      },
      {
        id: 'reports-audit-chain-manifest',
        title: 'Reports: Export Chain Manifest',
        subtitle: 'Download immutable chain manifest for external auditors',
        keywords: 'reports audit chain manifest export json compliance',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('audit-chain-manifest'),
      },
      {
        id: 'reports-audit-chain-import',
        title: 'Reports: Import Chain Manifest',
        subtitle: 'Load and verify external audit chain manifest JSON',
        keywords: 'reports import audit chain manifest verify json',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('audit-chain-import'),
      },
      {
        id: 'reports-package-key-rotate',
        title: 'Reports: Rotate Signing Key',
        subtitle: 'Generate a new ECDSA key and set it active for signing',
        keywords: 'reports rotate signing key ecdsa keyring',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('package-key-rotate'),
      },
      {
        id: 'reports-compliance-audit-export',
        title: 'Reports: Export Compliance Audit',
        subtitle: 'Download compliance audit trail as CSV',
        keywords: 'reports compliance audit export csv governance',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('compliance-audit-export'),
      },
      {
        id: 'reports-reset-intelligence',
        title: 'Reports: Reset Intelligence State',
        subtitle: 'Reset filters, simulators, and scenario history to baseline',
        keywords: 'reports reset baseline intelligence',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('reset-intelligence'),
      },
      {
        id: 'reports-recovery-plan',
        title: 'Reports: Activate Recovery Plan',
        subtitle: 'Run one-click drift recovery mode and action pack',
        keywords: 'reports recovery plan drift mitigation',
        category: 'Reports Shortcuts',
        run: () => runReportsAction('recovery-plan'),
      },
      {
        id: 'dashboard-insights',
        title: 'Dashboard: Open AI Insights',
        subtitle: 'Jump to AI Health Ops Insights panel',
        keywords: 'dashboard ai insights operations',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('jump-insights'),
      },
      {
        id: 'dashboard-warnings',
        title: 'Dashboard: Open Warning Signals',
        subtitle: 'Jump to operational warning cards',
        keywords: 'dashboard warning signals queue throughput cancellation',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('jump-warnings'),
      },
      {
        id: 'dashboard-mission',
        title: 'Dashboard: Open Mission Queue',
        subtitle: 'Jump to mission control priority queue',
        keywords: 'dashboard mission queue priority triage',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('jump-mission'),
      },
      {
        id: 'dashboard-live-feed',
        title: 'Dashboard: Open Live Feed',
        subtitle: 'Jump to live operations feed stream',
        keywords: 'dashboard live feed realtime events',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('jump-feed'),
      },
      {
        id: 'dashboard-toggle-feed',
        title: 'Dashboard: Toggle Live Feed',
        subtitle: 'Pause or resume live operations feed simulation',
        keywords: 'dashboard toggle feed pause resume',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('toggle-feed'),
      },
      {
        id: 'dashboard-autopilot',
        title: 'Dashboard: Run Recovery Autopilot',
        subtitle: 'Activate recovery mode and jump to warning signals',
        keywords: 'dashboard autopilot recovery mode',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('run-autopilot'),
      },
      {
        id: 'dashboard-mode-balanced',
        title: 'Dashboard: Set Autopilot Balanced',
        subtitle: 'Switch dashboard autopilot to balanced mode',
        keywords: 'dashboard autopilot balanced mode',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('set-autopilot-balanced'),
      },
      {
        id: 'dashboard-mode-growth',
        title: 'Dashboard: Set Autopilot Growth',
        subtitle: 'Switch dashboard autopilot to growth sprint mode',
        keywords: 'dashboard autopilot growth sprint mode',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('set-autopilot-growth'),
      },
      {
        id: 'dashboard-mode-recovery',
        title: 'Dashboard: Set Autopilot Recovery',
        subtitle: 'Switch dashboard autopilot to recovery mode',
        keywords: 'dashboard autopilot recovery mode set',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('set-autopilot-recovery'),
      },
      {
        id: 'dashboard-book',
        title: 'Dashboard: Book Appointment Shortcut',
        subtitle: 'Trigger quick-book navigation from dashboard actions',
        keywords: 'dashboard book appointment quick action',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('book'),
      },
      {
        id: 'dashboard-kpi',
        title: 'Dashboard: Open KPI Reports',
        subtitle: 'Jump from dashboard to reports KPI workspace',
        keywords: 'dashboard kpi reports analytics',
        category: 'Dashboard Shortcuts',
        run: () => runDashboardAction('kpi'),
      },
      {
        id: 'appointments-book',
        title: 'Appointments: Book New Appointment',
        subtitle: 'Open appointment booking form',
        keywords: 'appointments book create new',
        category: 'Appointments Shortcuts',
        run: () => runAppointmentsAction('book'),
      },
      {
        id: 'appointments-pending',
        title: 'Appointments: Filter Pending',
        subtitle: 'Show only pending appointments',
        keywords: 'appointments pending filter',
        category: 'Appointments Shortcuts',
        run: () => runAppointmentsAction('filter-pending'),
      },
      {
        id: 'appointments-today',
        title: 'Appointments: Filter Today',
        subtitle: 'Focus on today schedule',
        keywords: 'appointments today date filter',
        category: 'Appointments Shortcuts',
        run: () => runAppointmentsAction('filter-today'),
      },
      {
        id: 'appointments-calendar',
        title: 'Appointments: Jump to Calendar',
        subtitle: 'Scroll to appointment calendar section',
        keywords: 'appointments calendar section jump',
        category: 'Appointments Shortcuts',
        run: () => runAppointmentsAction('jump-calendar'),
      },
      {
        id: 'appointments-smart-queue',
        title: 'Appointments: Open Smart Queue',
        subtitle: 'Jump to queue prioritization and slot orchestration',
        keywords: 'appointments smart queue orchestrator priority',
        category: 'Appointments Shortcuts',
        run: () => runAppointmentsAction('jump-smart-queue'),
      },
      {
        id: 'appointments-auto-rebook',
        title: 'Appointments: Auto-Rebook Cancelled',
        subtitle: 'Automatically suggest and apply replacement slots',
        keywords: 'appointments auto rebook cancelled reschedule',
        category: 'Appointments Shortcuts',
        run: () => runAppointmentsAction('auto-rebook-cancelled'),
      },
      {
        id: 'patients-add',
        title: 'Patients: Add New Patient',
        subtitle: 'Open patient creation form',
        keywords: 'patients add new create',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('add'),
      },
      {
        id: 'patients-chronic',
        title: 'Patients: Filter Chronic',
        subtitle: 'Enable chronic-only filter',
        keywords: 'patients chronic filter risk',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('filter-chronic'),
      },
      {
        id: 'patients-growth',
        title: 'Patients: Jump to Growth Chart',
        subtitle: 'Scroll to patient growth analytics',
        keywords: 'patients growth chart analytics',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('jump-growth'),
      },
      {
        id: 'patients-table',
        title: 'Patients: Jump to Table',
        subtitle: 'Scroll to patients data table',
        keywords: 'patients table list records',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('jump-table'),
      },
      {
        id: 'patients-risk',
        title: 'Patients: Open Risk Cohorts',
        subtitle: 'Jump to precision risk cohort segmentation',
        keywords: 'patients risk cohort stratification',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('jump-risk'),
      },
      {
        id: 'patients-outreach',
        title: 'Patients: Open Outreach Queue',
        subtitle: 'Jump to proactive outreach prioritization queue',
        keywords: 'patients outreach queue proactive follow-up',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('jump-outreach'),
      },
      {
        id: 'patients-focus-high-risk',
        title: 'Patients: Focus High Risk',
        subtitle: 'Enable chronic-focused view and jump to risk panel',
        keywords: 'patients high risk chronic focus',
        category: 'Patients Shortcuts',
        run: () => runPatientsAction('focus-high-risk'),
      },
      {
        id: 'doctors-add',
        title: 'Doctors: Add New Doctor',
        subtitle: 'Open doctor creation form',
        keywords: 'doctors add new create physician',
        category: 'Doctors Shortcuts',
        run: () => runDoctorsAction('add'),
      },
      {
        id: 'doctors-active',
        title: 'Doctors: Filter Active',
        subtitle: 'Show only active doctors',
        keywords: 'doctors active filter roster',
        category: 'Doctors Shortcuts',
        run: () => runDoctorsAction('filter-active'),
      },
      {
        id: 'doctors-charts',
        title: 'Doctors: Jump to Charts',
        subtitle: 'Scroll to doctors analytics charts',
        keywords: 'doctors chart radar pie analytics',
        category: 'Doctors Shortcuts',
        run: () => runDoctorsAction('jump-charts'),
      },
      {
        id: 'doctors-capacity',
        title: 'Doctors: Open Capacity Intelligence',
        subtitle: 'Jump to burnout and capacity monitoring board',
        keywords: 'doctors capacity burnout load',
        category: 'Doctors Shortcuts',
        run: () => runDoctorsAction('jump-capacity'),
      },
      {
        id: 'doctors-rebalance',
        title: 'Doctors: Open Shift Rebalance Queue',
        subtitle: 'Jump to shift redistribution recommendation table',
        keywords: 'doctors rebalance shift queue allocation',
        category: 'Doctors Shortcuts',
        run: () => runDoctorsAction('jump-rebalance'),
      },
      {
        id: 'doctors-auto-balance',
        title: 'Doctors: Auto-Balance Shift Plan',
        subtitle: 'Apply top shift rebalance recommendations',
        keywords: 'doctors auto balance shift',
        category: 'Doctors Shortcuts',
        run: () => runDoctorsAction('auto-balance'),
      },
      {
        id: 'medical-records-new',
        title: 'Medical Records: Create New Record',
        subtitle: 'Open medical record creation form',
        keywords: 'medical records new create',
        category: 'Medical Records Shortcuts',
        run: () => runMedicalRecordsAction('new'),
      },
      {
        id: 'medical-records-high-risk',
        title: 'Medical Records: Filter High Risk',
        subtitle: 'Show only high-risk records',
        keywords: 'medical records high risk filter',
        category: 'Medical Records Shortcuts',
        run: () => runMedicalRecordsAction('filter-high-risk'),
      },
      {
        id: 'medical-records-export',
        title: 'Medical Records: Export CSV',
        subtitle: 'Export current records table',
        keywords: 'medical records export csv download',
        category: 'Medical Records Shortcuts',
        run: () => runMedicalRecordsAction('export'),
      },
      {
        id: 'medical-records-trend',
        title: 'Medical Records: Jump to Risk Trend',
        subtitle: 'Scroll to risk trend chart',
        keywords: 'medical records risk trend chart',
        category: 'Medical Records Shortcuts',
        run: () => runMedicalRecordsAction('jump-trend'),
      },
      {
        id: 'medical-records-table',
        title: 'Medical Records: Jump to Table',
        subtitle: 'Scroll to medical records table',
        keywords: 'medical records table list',
        category: 'Medical Records Shortcuts',
        run: () => runMedicalRecordsAction('jump-table'),
      },
      {
        id: 'workspace-clear-filters',
        title: 'Clear Filters on Current Page',
        subtitle: 'Reset active filters on analytics and management pages',
        keywords: 'clear reset filters page',
        category: 'Actions',
        run: () => {
          if (currentRoute === ROUTES.REPORTS) runReportsAction('clear');
          if (currentRoute === ROUTES.APPOINTMENTS) runAppointmentsAction('clear-filters');
          if (currentRoute === ROUTES.PATIENTS) runPatientsAction('clear-filters');
          if (currentRoute === ROUTES.DOCTORS) runDoctorsAction('clear-filters');
          if (currentRoute === ROUTES.MEDICAL_RECORDS) runMedicalRecordsAction('clear-filters');
        },
      },
      {
        id: 'scroll-top',
        title: 'Scroll to Top',
        subtitle: 'Jump to top of current page',
        keywords: 'top jump navigation',
        category: 'Actions',
        run: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      },
      {
        id: 'copy-url',
        title: 'Copy Current Page URL',
        subtitle: 'Copy page link to clipboard',
        keywords: 'share link clipboard url',
        category: 'Actions',
        run: async () => {
          const href = window.location.href;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(href);
          }
        },
      },
      {
        id: 'toggle-theme',
        title: 'Toggle Light/Dark Theme',
        subtitle: 'Switch app theme instantly',
        keywords: 'theme dark light mode appearance',
        category: 'Actions',
        run: () => {
          const body = document.body;
          if (body.classList.contains('theme-dark')) {
            body.classList.remove('theme-dark');
            body.classList.add('theme-light');
            return;
          }
          body.classList.remove('theme-light');
          body.classList.add('theme-dark');
        },
      },
      {
        id: 'open-ops-alerts',
        title: 'Open Operations Alerts Panel',
        subtitle: 'Show live alert panel in header and jump to incidents quickly',
        keywords: 'operations alerts panel critical incident doctors',
        category: 'Actions',
        run: () => window.dispatchEvent(new Event('ops-alerts:open')),
      },
      {
        id: 'ops-alerts-mark-unread',
        title: 'Operations Alerts: Mark All Unread',
        subtitle: 'Set current operations alert batch back to unread',
        keywords: 'operations alerts unread badge new mark',
        category: 'Actions',
        run: () => window.dispatchEvent(new Event('ops-alerts:mark-unread')),
      },
      {
        id: 'ops-alerts-toggle-pulse',
        title: 'Operations Alerts: Toggle Pulse Animation',
        subtitle: 'Enable or disable badge pulse without opening panel',
        keywords: 'operations alerts pulse animation toggle',
        category: 'Actions',
        run: () => window.dispatchEvent(new Event('ops-alerts:toggle-pulse')),
      },
      {
        id: 'logout',
        title: 'Logout',
        subtitle: 'Sign out from current account',
        keywords: 'exit signout auth',
        category: 'Account',
        run: () => onLogout(),
      }
    );

    return baseCommands;
  }, [currentRoute, navigate, onLogout]);

  const filteredCommands = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return commands;

    return commands
      .map((cmd) => ({ ...cmd, score: scoreCommand(cmd, keyword) }))
      .filter((cmd) => cmd.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }, [commands, query]);

  const commandMap = useMemo(
    () => new Map(commands.map((cmd) => [cmd.id, cmd])),
    [commands]
  );

  const sections = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (keyword) {
      const grouped = filteredCommands.reduce((acc, command) => {
        const key = command.category || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(command);
        return acc;
      }, {});

      return Object.entries(grouped).map(([title, items]) => ({ title, items }));
    }

    const recent = recentCommandIds
      .map((id) => commandMap.get(id))
      .filter(Boolean)
      .slice(0, RECENT_COMMANDS_LIMIT);

    const recentIdSet = new Set(recent.map((item) => item.id));
    const grouped = commands.reduce((acc, command) => {
      if (recentIdSet.has(command.id)) return acc;
      const key = command.category || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(command);
      return acc;
    }, {});

    const result = [];
    if (recent.length) result.push({ title: 'Recent', items: recent });

    Object.entries(grouped).forEach(([title, items]) => {
      result.push({ title, items });
    });

    return result;
  }, [commandMap, commands, filteredCommands, query, recentCommandIds]);

  const visibleCommands = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections]
  );

  const runCommand = (command) => {
    setRecentCommandIds((prev) => [command.id, ...prev.filter((id) => id !== command.id)].slice(0, RECENT_COMMANDS_LIMIT));
    Promise.resolve(command.run()).finally(() => {
      setIsOpen(false);
      setQuery('');
    });
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (selectedIndex >= visibleCommands.length) {
      setSelectedIndex(visibleCommands.length ? 0 : -1);
    }
  }, [selectedIndex, visibleCommands.length]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const onOpenRequest = () => setIsOpen(true);

    window.addEventListener('command-palette:open', onOpenRequest);
    return () => window.removeEventListener('command-palette:open', onOpenRequest);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const metaHotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const slashHotkey = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;

      if (metaHotkey || (slashHotkey && !isEditableTarget(event.target))) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (!visibleCommands.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1 + visibleCommands.length) % visibleCommands.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + visibleCommands.length) % visibleCommands.length);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = visibleCommands[selectedIndex];
        if (selected) {
          runCommand(selected);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, selectedIndex, visibleCommands]);

  useEffect(() => {
    setIsOpen(false);
    setQuery('');
  }, [location.pathname]);

  if (!isOpen) return null;

  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" onClick={() => setIsOpen(false)}>
      <div className="cp-panel" onClick={(event) => event.stopPropagation()}>
        <div className="cp-header">
          <input
            ref={inputRef}
            className="cp-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or search page..."
            aria-label="Command search"
          />
          <span className="cp-hint">Esc to close</span>
        </div>
        <div className="cp-list" role="listbox" aria-label="Available commands">
          {visibleCommands.length === 0 ? (
            <div className="cp-empty">No commands match your search.</div>
          ) : (
            (() => {
              let runningIndex = -1;
              return sections.map((section) => (
                <div key={section.title} className="cp-section">
                  <div className="cp-section-title">{section.title}</div>
                  {section.items.map((command) => {
                    runningIndex += 1;
                    const absoluteIndex = runningIndex;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        className={`cp-item ${absoluteIndex === selectedIndex ? 'active' : ''}`}
                        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                        onClick={() => runCommand(command)}
                      >
                        <span className="cp-title">{command.title}</span>
                        <span className="cp-subtitle">{command.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>
        <div className="cp-footer">
          <span>Enter: run</span>
          <span>↑/↓: select</span>
          <span>Cmd/Ctrl + K: toggle</span>
        </div>
      </div>
    </div>
  );
}
