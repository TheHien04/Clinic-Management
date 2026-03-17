import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Reports.css';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppointmentContext } from '../contexts/AppointmentContext';
import { exportAppointmentsCSV, exportToCSV } from '../utils/exportUtils';
import { getAppointmentsForAnalyticsAPI } from '../services/appointments';
import { askReportsAssistantAPI, getReportsAnalyticsAPI } from '../services/reports';
import { formatDateByOptions, formatNumber, formatTimeShort } from '../utils/i18nFormat';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  Bar,
  Line,
  Area,
  BarChart,
} from 'recharts';

const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

const monthKey = (dateValue) => (dateValue ? dateValue.slice(0, 7) : 'Unknown');

const rollingStats = (arr, idx, field, windowSize = 3) => {
  const start = Math.max(0, idx - windowSize + 1);
  const values = arr.slice(start, idx + 1).map((item) => Number(item[field] || 0));
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return { avg, std: Math.sqrt(variance) };
};

const REPORTS_PRESETS_KEY = 'reports_filter_presets_v1';
const REPORTS_ALERT_RULES_KEY = 'reports_alert_rules_v1';
const REPORTS_SCENARIO_HISTORY_KEY = 'reports_scenario_history_v1';
const REPORTS_EMAIL_RECIPIENTS_KEY = 'reports_email_recipients_v1';
const REPORTS_DTX_POLICY_KEY = 'reports_dtx_policy_v1';
const REPORTS_DTX_POLICY_HISTORY_KEY = 'reports_dtx_policy_history_v1';
const REPORTS_OUTREACH_CAPACITY_KEY = 'reports_outreach_capacity_v1';
const REPORTS_DTX_APPROVAL_KEY = 'reports_dtx_approval_v1';
const REPORTS_GOVERNANCE_AUDIT_KEY = 'reports_governance_audit_v1';

const DEFAULT_DTX_POLICY = {
  sessionWeights: {
    completion: 0.35,
    engagement: 0.25,
    riskInverse: 0.4,
  },
  riskThresholds: {
    high: 70,
    medium: 45,
  },
  expectedGainOffset: 45,
  expectedGainClamp: {
    min: 2,
    max: 48,
  },
};

const validateDtxPolicyPayload = (payload) => {
  const completion = Number(payload?.sessionWeights?.completion ?? NaN);
  const engagement = Number(payload?.sessionWeights?.engagement ?? NaN);
  const riskInverse = Number(payload?.sessionWeights?.riskInverse ?? NaN);
  const sumWeights = completion + engagement + riskInverse;

  if ([completion, engagement, riskInverse].some((v) => Number.isNaN(v) || v < 0 || v > 1)) {
    throw new Error('sessionWeights must be numbers between 0 and 1');
  }
  if (Math.abs(sumWeights - 1) > 0.0001) {
    throw new Error('sessionWeights must sum to 1.0');
  }

  const high = Number(payload?.riskThresholds?.high ?? NaN);
  const medium = Number(payload?.riskThresholds?.medium ?? NaN);
  if ([high, medium].some((v) => Number.isNaN(v) || v < 0 || v > 100) || medium > high) {
    throw new Error('riskThresholds are invalid');
  }

  const gainOffset = Number(payload?.expectedGainOffset ?? NaN);
  if (Number.isNaN(gainOffset)) {
    throw new Error('expectedGainOffset is invalid');
  }

  const clampMin = Number(payload?.expectedGainClamp?.min ?? NaN);
  const clampMax = Number(payload?.expectedGainClamp?.max ?? NaN);
  if ([clampMin, clampMax].some((v) => Number.isNaN(v)) || clampMin > clampMax) {
    throw new Error('expectedGainClamp is invalid');
  }

  return {
    sessionWeights: {
      completion,
      engagement,
      riskInverse,
    },
    riskThresholds: {
      high,
      medium,
    },
    expectedGainOffset: gainOffset,
    expectedGainClamp: {
      min: clampMin,
      max: clampMax,
    },
  };
};

const toDateOnly = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const computeDeltaPercent = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hashString = (value) => {
  return String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

const buildAuditChainEntryHash = (chainIndex, previousHash, row) => {
  const payload = JSON.stringify({ index: chainIndex, previousHash, row });
  const primary = hashString(payload).toString(16).padStart(8, '0');
  const secondary = hashString(`${payload}|${chainIndex - 1}`).toString(16).padStart(8, '0');
  return `${primary}${secondary}`;
};

const escapeHtml = (value) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const inferPatientRiskBand = (row) => {
  const service = String(row.service || '').toLowerCase();
  const status = String(row.status || '').toLowerCase();
  const fee = Number(row.fee || 0);

  let riskScore = 0;
  if (status === 'cancelled') riskScore += 2;
  if (status === 'pending') riskScore += 1;
  if (service.includes('cardio') || service.includes('neuro')) riskScore += 2;
  if (service.includes('derma') || service.includes('general')) riskScore += 0.5;
  if (fee >= 250000) riskScore += 1;

  if (riskScore >= 3) return 'high';
  if (riskScore >= 1.5) return 'medium';
  return 'low';
};

const getPreviousWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const daysSinceMonday = (day + 6) % 7;

  const thisWeekMonday = new Date(now);
  thisWeekMonday.setHours(0, 0, 0, 0);
  thisWeekMonday.setDate(now.getDate() - daysSinceMonday);

  const previousMonday = new Date(thisWeekMonday);
  previousMonday.setDate(thisWeekMonday.getDate() - 7);

  const previousSunday = new Date(previousMonday);
  previousSunday.setDate(previousMonday.getDate() + 6);

  return {
    from: previousMonday.toISOString().slice(0, 10),
    to: previousSunday.toISOString().slice(0, 10),
  };
};

const EMAIL_RECIPIENT_PROFILES = {
  leadership: {
    label: 'Leadership (CEO/COO/Ops Lead)',
    to: ['ceo@clinic.local'],
    cc: ['coo@clinic.local', 'opslead@clinic.local'],
  },
  operations: {
    label: 'Operations Board',
    to: ['opslead@clinic.local'],
    cc: ['scheduler@clinic.local', 'carequality@clinic.local'],
  },
  finance: {
    label: 'Finance and Strategy',
    to: ['finance@clinic.local'],
    cc: ['controller@clinic.local', 'strategy@clinic.local'],
  },
};

const mapAppointmentStatusToFhir = (status) => {
  if (status === 'completed') return 'fulfilled';
  if (status === 'cancelled') return 'cancelled';
  return 'booked';
};

const toBase64 = (bytes) => {
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
};

const toHex = (bytes) => {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const fromBase64 = (value) => {
  const binary = atob(value || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const { doctors, appointments: originalAppointments } = useAppointmentContext();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [doctorFilter, setDoctorFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [apiAppointments, setApiAppointments] = useState([]);
  const [loadingSource, setLoadingSource] = useState(true);
  const [sourceLabel, setSourceLabel] = useState('Loading...');
  const [remoteAnalytics, setRemoteAnalytics] = useState(null);
  const [copilotQuestion, setCopilotQuestion] = useState('Where is the biggest operational risk this month?');
  const [copilotAnswer, setCopilotAnswer] = useState('');
  const [copilotHighlights, setCopilotHighlights] = useState([]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [briefCopyStatus, setBriefCopyStatus] = useState('');
  const [emailTemplateStatus, setEmailTemplateStatus] = useState('');
  const [selectedEmailProfile, setSelectedEmailProfile] = useState('leadership');
  const [customEmailTo, setCustomEmailTo] = useState('');
  const [customEmailCc, setCustomEmailCc] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('');
  const [fhirExportStatus, setFhirExportStatus] = useState('');
  const [complianceStatus, setComplianceStatus] = useState('');
  const [packageIntegrityHash, setPackageIntegrityHash] = useState('');
  const [packageSignature, setPackageSignature] = useState('');
  const [signatureStatus, setSignatureStatus] = useState('');
  const [signatureVerifyStatus, setSignatureVerifyStatus] = useState('');
  const [signedPackageEnvelope, setSignedPackageEnvelope] = useState(null);
  const [signatureVerificationDetails, setSignatureVerificationDetails] = useState(null);
  const [signingKeyRing, setSigningKeyRing] = useState([]);
  const [activeSigningKeyId, setActiveSigningKeyId] = useState('');
  const [manifestImportReport, setManifestImportReport] = useState(null);
  const [dtxPolicyDraft, setDtxPolicyDraft] = useState(JSON.stringify(DEFAULT_DTX_POLICY, null, 2));
  const [dtxPolicy, setDtxPolicy] = useState(DEFAULT_DTX_POLICY);
  const [dtxPolicyStatus, setDtxPolicyStatus] = useState('');
  const [dtxPolicyHistory, setDtxPolicyHistory] = useState([]);
  const [selectedDtxPolicyVersionId, setSelectedDtxPolicyVersionId] = useState('');
  const [selectedDtxPolicyCompareId, setSelectedDtxPolicyCompareId] = useState('');
  const [dtxPolicyBundleStatus, setDtxPolicyBundleStatus] = useState('');
  const [dtxPolicyVerifyStatus, setDtxPolicyVerifyStatus] = useState('');
  const [dtxPolicyVerifyReport, setDtxPolicyVerifyReport] = useState(null);
  const [dtxPolicyApproval, setDtxPolicyApproval] = useState({
    status: 'draft',
    reviewedAt: '',
    approvedAt: '',
    note: '',
  });
  const [governanceAuditTrail, setGovernanceAuditTrail] = useState([]);
  const [outreachCapacity, setOutreachCapacity] = useState({
    careManagers: 2,
    nurses: 4,
    dailyContactsPerStaff: 16,
    urgentSlotsPerDay: 8,
  });
  const [feedReplayActive, setFeedReplayActive] = useState(false);
  const [feedReplayCursor, setFeedReplayCursor] = useState(0);
  const [feedReplayIntervalMs, setFeedReplayIntervalMs] = useState(1200);
  const [outreachRebalancePreview, setOutreachRebalancePreview] = useState(null);
  const [outreachRebalanceRollbackSnapshot, setOutreachRebalanceRollbackSnapshot] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [scenarioHistory, setScenarioHistory] = useState([]);
  const [alertRules, setAlertRules] = useState({
    minCompletionRate: 80,
    maxCancellationRate: 25,
    minRetentionRate: 35,
  });
  const [simulator, setSimulator] = useState({
    extraAppointments: 10,
    avgFee: 220000,
    completionLift: 5,
  });
  const [digitalTwin, setDigitalTwin] = useState({
    doctorHours: 160,
    noShowRate: 12,
    aiAutomation: 25,
    telehealthMix: 20,
  });
  const copilotInputRef = useRef(null);
  const alertCenterRef = useRef(null);
  const simulatorRef = useRef(null);
  const qualityRef = useRef(null);
  const playbookRef = useRef(null);
  const twinRef = useRef(null);
  const schedulerRef = useRef(null);
  const trajectoryRef = useRef(null);
  const precisionRef = useRef(null);
  const rpmRef = useRef(null);
  const pathwayRef = useRef(null);
  const subscriptionRef = useRef(null);
  const dtxRef = useRef(null);
  const populationRef = useRef(null);
  const benchmarkRef = useRef(null);
  const executiveRef = useRef(null);
  const scenarioRef = useRef(null);
  const comparisonRef = useRef(null);
  const briefingRef = useRef(null);
  const deltaRef = useRef(null);
  const weeklyRef = useRef(null);
  const recoveryRef = useRef(null);
  const complianceRef = useRef(null);
  const manifestFileInputRef = useRef(null);
  const dtxPolicyFileInputRef = useRef(null);
  const dtxSignedBundleFileInputRef = useRef(null);
  const signingPrivateKeysRef = useRef(new Map());

  useEffect(() => {
    let active = true;

    const fetchFromApi = async () => {
      try {
        const rows = await getAppointmentsForAnalyticsAPI({ limit: 300, offset: 0 });
        if (!active) return;

        if (rows.length > 0) {
          setApiAppointments(rows);
          setSourceLabel('Data source: Backend API');
        } else {
          setSourceLabel('Data source: Mock fallback (backend needs auth/data seed)');
        }
      } catch {
        if (!active) return;
        setSourceLabel('Data source: Mock fallback (API unavailable)');
      } finally {
        if (active) setLoadingSource(false);
      }
    };

    fetchFromApi();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const presetRaw = localStorage.getItem(REPORTS_PRESETS_KEY);
      const ruleRaw = localStorage.getItem(REPORTS_ALERT_RULES_KEY);
      const historyRaw = localStorage.getItem(REPORTS_SCENARIO_HISTORY_KEY);
      const emailRaw = localStorage.getItem(REPORTS_EMAIL_RECIPIENTS_KEY);
      const dtxPolicyRaw = localStorage.getItem(REPORTS_DTX_POLICY_KEY);
      const dtxHistoryRaw = localStorage.getItem(REPORTS_DTX_POLICY_HISTORY_KEY);
      const outreachCapacityRaw = localStorage.getItem(REPORTS_OUTREACH_CAPACITY_KEY);
      const dtxApprovalRaw = localStorage.getItem(REPORTS_DTX_APPROVAL_KEY);
      const governanceAuditRaw = localStorage.getItem(REPORTS_GOVERNANCE_AUDIT_KEY);

      if (presetRaw) {
        const parsed = JSON.parse(presetRaw);
        if (Array.isArray(parsed)) setSavedPresets(parsed);
      }

      if (ruleRaw) {
        const parsed = JSON.parse(ruleRaw);
        if (parsed && typeof parsed === 'object') {
          setAlertRules((prev) => ({ ...prev, ...parsed }));
        }
      }

      if (historyRaw) {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed)) setScenarioHistory(parsed);
      }

      if (emailRaw) {
        const parsed = JSON.parse(emailRaw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.profile && EMAIL_RECIPIENT_PROFILES[parsed.profile]) {
            setSelectedEmailProfile(parsed.profile);
          }
          if (typeof parsed.to === 'string') setCustomEmailTo(parsed.to);
          if (typeof parsed.cc === 'string') setCustomEmailCc(parsed.cc);
        }
      }

      if (dtxPolicyRaw) {
        const parsed = JSON.parse(dtxPolicyRaw);
        if (parsed && typeof parsed === 'object') {
          setDtxPolicy(parsed);
          setDtxPolicyDraft(JSON.stringify(parsed, null, 2));
        }
      }

      if (dtxHistoryRaw) {
        const parsed = JSON.parse(dtxHistoryRaw);
        if (Array.isArray(parsed)) {
          setDtxPolicyHistory(parsed);
          if (parsed[0]?.id) setSelectedDtxPolicyVersionId(parsed[0].id);
        }
      }

      if (outreachCapacityRaw) {
        const parsed = JSON.parse(outreachCapacityRaw);
        if (parsed && typeof parsed === 'object') {
          setOutreachCapacity((prev) => ({ ...prev, ...parsed }));
        }
      }

      if (dtxApprovalRaw) {
        const parsed = JSON.parse(dtxApprovalRaw);
        if (parsed && typeof parsed === 'object') {
          setDtxPolicyApproval((prev) => ({ ...prev, ...parsed }));
        }
      }

      if (governanceAuditRaw) {
        const parsed = JSON.parse(governanceAuditRaw);
        if (Array.isArray(parsed)) {
          setGovernanceAuditTrail(parsed);
        }
      }
    } catch {
      // Keep defaults when local storage payload is invalid.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(REPORTS_PRESETS_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  useEffect(() => {
    localStorage.setItem(REPORTS_ALERT_RULES_KEY, JSON.stringify(alertRules));
  }, [alertRules]);

  useEffect(() => {
    localStorage.setItem(REPORTS_SCENARIO_HISTORY_KEY, JSON.stringify(scenarioHistory));
  }, [scenarioHistory]);

  useEffect(() => {
    localStorage.setItem(REPORTS_EMAIL_RECIPIENTS_KEY, JSON.stringify({
      profile: selectedEmailProfile,
      to: customEmailTo,
      cc: customEmailCc,
    }));
  }, [selectedEmailProfile, customEmailTo, customEmailCc]);

  useEffect(() => {
    localStorage.setItem(REPORTS_DTX_POLICY_KEY, JSON.stringify(dtxPolicy));
  }, [dtxPolicy]);

  useEffect(() => {
    localStorage.setItem(REPORTS_DTX_POLICY_HISTORY_KEY, JSON.stringify(dtxPolicyHistory));
  }, [dtxPolicyHistory]);

  useEffect(() => {
    localStorage.setItem(REPORTS_OUTREACH_CAPACITY_KEY, JSON.stringify(outreachCapacity));
  }, [outreachCapacity]);

  useEffect(() => {
    localStorage.setItem(REPORTS_DTX_APPROVAL_KEY, JSON.stringify(dtxPolicyApproval));
  }, [dtxPolicyApproval]);

  useEffect(() => {
    localStorage.setItem(REPORTS_GOVERNANCE_AUDIT_KEY, JSON.stringify(governanceAuditTrail));
  }, [governanceAuditTrail]);

  const mockSeed = useMemo(() => [
    { id: 11, patient: 'Pham Van K', doctor: 'Dr. Smith', date: '2025-04-12', service: 'General Checkup', fee: 200000, status: 'completed' },
    { id: 9, patient: 'Tran Van I', doctor: 'Dr. John', date: '2025-05-18', service: 'ENT Exam', fee: 170000, status: 'completed' },
    { id: 10, patient: 'Le Thi J', doctor: 'Dr. Anna', date: '2025-05-25', service: 'Cardiology', fee: 220000, status: 'completed' },
    { id: 13, patient: 'Nguyen Van M', doctor: 'Dr. Smith', date: '2025-05-05', service: 'General Checkup', fee: 200000, status: 'completed' },
    { id: 6, patient: 'Tran Thi F', doctor: 'Dr. John', date: '2025-06-20', service: 'Eye Exam', fee: 150000, status: 'completed' },
    { id: 8, patient: 'Pham Thi H', doctor: 'Dr. Smith', date: '2025-06-10', service: 'General Checkup', fee: 210000, status: 'completed' },
    { id: 5, patient: 'Nguyen Van E', doctor: 'Dr. Smith', date: '2025-07-15', service: 'General Checkup', fee: 200000, status: 'completed' },
    { id: 7, patient: 'Le Van G', doctor: 'Dr. Anna', date: '2025-07-22', service: 'Dermatology', fee: 180000, status: 'completed' },
    { id: 14, patient: 'Tran Van N', doctor: 'Dr. John', date: '2025-07-03', service: 'ENT Exam', fee: 170000, status: 'completed' },
    { id: 15, patient: 'Le Thi O', doctor: 'Dr. Anna', date: '2025-07-28', service: 'Cardiology', fee: 220000, status: 'completed' },
  ], []);

  const appointments = useMemo(() => {
    if (apiAppointments.length) {
      return apiAppointments.map((a) => ({ ...a, status: normalizeStatus(a.status) }));
    }
    return [
      ...originalAppointments.map((a) => ({ ...a, status: normalizeStatus(a.status) })),
      ...mockSeed,
    ];
  }, [apiAppointments, originalAppointments, mockSeed]);

  useEffect(() => {
    let active = true;

    const fetchRemoteAnalytics = async () => {
      try {
        const response = await getReportsAnalyticsAPI({
          from: dateRange.from,
          to: dateRange.to,
          status: statusFilter,
          service: serviceFilter,
        });
        const data = response?.data || response;
        if (!active) return;
        if (data?.monthlySeries?.length) {
          setRemoteAnalytics(data);
          if (data.source === 'database') {
            setSourceLabel('Data source: Backend API analytics');
          } else {
            setSourceLabel('Data source: Backend fallback demo (DB not seeded)');
          }
        }
      } catch {
        if (!active) return;
      }
    };

    fetchRemoteAnalytics();

    return () => {
      active = false;
    };
  }, [dateRange.from, dateRange.to, statusFilter, serviceFilter]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const matchDoctor = !doctorFilter || app.doctor === doctorFilter;
      const matchService = !serviceFilter || app.service === serviceFilter;
      const matchStatus = !statusFilter || app.status === statusFilter;
      const matchDate = (!dateRange.from || new Date(app.date) >= new Date(dateRange.from)) &&
        (!dateRange.to || new Date(app.date) <= new Date(dateRange.to));
      return matchDoctor && matchService && matchStatus && matchDate;
    });
  }, [appointments, doctorFilter, serviceFilter, statusFilter, dateRange]);

  const totalPatients = useMemo(() => new Set(filteredAppointments.map(a => a.patient)).size, [filteredAppointments]);
  const totalAppointments = filteredAppointments.length;
  const totalRevenue = useMemo(() => filteredAppointments.reduce((sum, a) => sum + (a.fee || 0), 0), [filteredAppointments]);

  const doctorStats = useMemo(() => {
    return doctors.map(doc => {
      const docApps = filteredAppointments.filter(a => a.doctor === doc.name);
      const completed = docApps.filter((a) => a.status === 'completed').length;
      const completionRate = docApps.length ? Math.round((completed / docApps.length) * 100) : 0;
      return {
        id: doc.id,
        name: doc.name,
        specialty: doc.specialty,
        appointments: docApps.length,
        revenue: docApps.reduce((sum, a) => sum + (a.fee || 0), 0),
        completionRate,
        rating: doc.kpi?.rating || '-',
      };
    });
  }, [doctors, filteredAppointments]);

  const serviceList = useMemo(() => {
    const set = new Set();
    appointments.forEach(a => a.service && set.add(a.service));
    return Array.from(set);
  }, [appointments]);
  const statusList = useMemo(() => {
    const set = new Set();
    appointments.forEach(a => a.status && set.add(a.status));
    return Array.from(set);
  }, [appointments]);

  const monthlySeries = useMemo(() => {
    const grouped = {};
    filteredAppointments.forEach((a) => {
      const key = monthKey(a.date);
      if (!grouped[key]) {
        grouped[key] = {
          month: key,
          appointments: 0,
          revenue: 0,
          completed: 0,
          cancelled: 0,
          patients: new Set(),
        };
      }
      grouped[key].appointments += 1;
      grouped[key].revenue += Number(a.fee || 0);
      grouped[key].patients.add(a.patient);
      if (a.status === 'completed') grouped[key].completed += 1;
      if (a.status === 'cancelled') grouped[key].cancelled += 1;
    });

    const base = Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        month: item.month,
        appointments: item.appointments,
        revenue: item.revenue,
        uniquePatients: item.patients.size,
        completionRate: item.appointments ? Math.round((item.completed / item.appointments) * 100) : 0,
        cancellationRate: item.appointments ? Math.round((item.cancelled / item.appointments) * 100) : 0,
      }));

    return base.map((item, idx) => {
      const { avg, std } = rollingStats(base, idx, 'appointments', 3);
      const lower = Math.max(0, avg - std * 1.28);
      const upper = avg + std * 1.28;
      return {
        ...item,
        trend: Number(avg.toFixed(2)),
        lower: Number(lower.toFixed(2)),
        upper: Number(upper.toFixed(2)),
        band: Number((upper - lower).toFixed(2)),
      };
    });
  }, [filteredAppointments]);

  const effectiveMonthlySeries = remoteAnalytics?.monthlySeries?.length ? remoteAnalytics.monthlySeries : monthlySeries;

  const cohortSeries = useMemo(() => {
    const ordered = [...filteredAppointments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const seenPatients = new Set();
    const bucket = {};

    ordered.forEach((a) => {
      const m = monthKey(a.date);
      if (!bucket[m]) {
        bucket[m] = {
          month: m,
          newSet: new Set(),
          returningSet: new Set(),
        };
      }

      if (seenPatients.has(a.patient)) {
        bucket[m].returningSet.add(a.patient);
      } else {
        bucket[m].newSet.add(a.patient);
      }
      seenPatients.add(a.patient);
    });

    return Object.values(bucket)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => {
        const newPatients = item.newSet.size;
        const returningPatients = item.returningSet.size;
        const total = newPatients + returningPatients;
        return {
          month: item.month,
          newPatients,
          returningPatients,
          retentionRate: total ? Math.round((returningPatients / total) * 100) : 0,
        };
      });
  }, [filteredAppointments]);

  const effectiveCohortSeries = remoteAnalytics?.cohortSeries?.length ? remoteAnalytics.cohortSeries : cohortSeries;

  const latestMonth = effectiveMonthlySeries[effectiveMonthlySeries.length - 1];
  const latestCohort = effectiveCohortSeries[effectiveCohortSeries.length - 1];

  const anomalySignals = useMemo(() => {
    if (remoteAnalytics?.anomalies?.length) return remoteAnalytics.anomalies;
    if (!filteredAppointments.length) return [];

    const monthlyByPair = {};
    filteredAppointments.forEach((a) => {
      const key = `${a.doctor}__${a.service}`;
      const month = monthKey(a.date);
      if (!monthlyByPair[key]) monthlyByPair[key] = {};
      monthlyByPair[key][month] = (monthlyByPair[key][month] || 0) + 1;
    });

    const items = [];
    Object.entries(monthlyByPair).forEach(([pair, monthMap]) => {
      const points = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
      if (points.length < 3) return;

      const values = points.map((p) => p[1]);
      const latest = values[values.length - 1];
      const base = values.slice(0, -1);
      const mean = base.reduce((s, v) => s + v, 0) / base.length;
      const variance = base.reduce((s, v) => s + (v - mean) ** 2, 0) / base.length;
      const std = Math.sqrt(variance);
      const z = std > 0 ? (latest - mean) / std : 0;

      if (z >= 1.5 && latest >= 3) {
        const [doctor, service] = pair.split('__');
        items.push({
          type: 'demand-spike',
          doctor,
          service,
          detail: `${doctor} - ${service} jumped to ${latest} visits this month (z=${z.toFixed(2)}).`,
          severity: z >= 2 ? 'high' : 'medium',
        });
      }
    });

    const byDoctor = {};
    filteredAppointments.forEach((a) => {
      if (!byDoctor[a.doctor]) byDoctor[a.doctor] = { total: 0, cancelled: 0 };
      byDoctor[a.doctor].total += 1;
      if (a.status === 'cancelled') byDoctor[a.doctor].cancelled += 1;
    });

    Object.entries(byDoctor).forEach(([doctor, stat]) => {
      const rate = stat.total ? (stat.cancelled / stat.total) * 100 : 0;
      if (stat.total >= 3 && rate > 30) {
        items.push({
          type: 'cancellation-risk',
          doctor,
          service: 'all services',
          detail: `${doctor} has cancellation rate ${rate.toFixed(0)}% (${stat.cancelled}/${stat.total}).`,
          severity: rate > 45 ? 'high' : 'medium',
        });
      }
    });

    return items.slice(0, 6);
  }, [filteredAppointments, remoteAnalytics]);

  const aiNotes = useMemo(() => {
    if (remoteAnalytics?.aiNotes?.length) return remoteAnalytics.aiNotes;
    if (!effectiveMonthlySeries.length) return [];

    const current = effectiveMonthlySeries[effectiveMonthlySeries.length - 1];
    const notes = [];

    if (current.appointments > current.upper) {
      notes.push('Demand spike detected: current volume is above confidence band. Consider opening overflow slots.');
    }
    if (current.completionRate < 80) {
      notes.push(`Completion rate is ${current.completionRate}%, below outpatient target (80%+). Review no-show workflow.`);
    }
    if (latestCohort && latestCohort.retentionRate < 35) {
      notes.push(`Cohort retention is ${latestCohort.retentionRate}%. Strengthen follow-up reminders for chronic patients.`);
    }
    if (!notes.length) {
      notes.push('Operational pattern is stable this month: throughput and retention are within expected range.');
    }

    return notes;
  }, [effectiveMonthlySeries, latestCohort, remoteAnalytics]);

  const comparisonMetrics = useMemo(() => {
    const scoped = appointments.filter((app) => {
      const matchDoctor = !doctorFilter || app.doctor === doctorFilter;
      const matchService = !serviceFilter || app.service === serviceFilter;
      const matchStatus = !statusFilter || app.status === statusFilter;
      return matchDoctor && matchService && matchStatus;
    });

    if (!scoped.length) {
      return {
        current: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 },
        previous: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 },
        deltas: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 },
      };
    }

    const dates = scoped.map((item) => toDateOnly(item.date)).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) {
      return {
        current: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 },
        previous: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 },
        deltas: { appointments: 0, revenue: 0, completionRate: 0, patients: 0 },
      };
    }

    const currentFrom = toDateOnly(dateRange.from) || dates[0];
    const currentTo = toDateOnly(dateRange.to) || dates[dates.length - 1];
    const windowDays = Math.max(1, Math.floor((currentTo - currentFrom) / 86400000) + 1);
    const previousTo = new Date(currentFrom);
    previousTo.setDate(previousTo.getDate() - 1);
    const previousFrom = new Date(previousTo);
    previousFrom.setDate(previousFrom.getDate() - (windowDays - 1));

    const inRange = (item, from, to) => {
      const d = toDateOnly(item.date);
      if (!d) return false;
      return d >= from && d <= to;
    };

    const currentRows = scoped.filter((item) => inRange(item, currentFrom, currentTo));
    const previousRows = scoped.filter((item) => inRange(item, previousFrom, previousTo));

    const summarize = (rows) => {
      const completion = rows.length
        ? Math.round((rows.filter((r) => r.status === 'completed').length / rows.length) * 100)
        : 0;
      return {
        appointments: rows.length,
        revenue: rows.reduce((sum, row) => sum + Number(row.fee || 0), 0),
        completionRate: completion,
        patients: new Set(rows.map((row) => row.patient)).size,
      };
    };

    const current = summarize(currentRows);
    const previous = summarize(previousRows);

    return {
      current,
      previous,
      deltas: {
        appointments: computeDeltaPercent(current.appointments, previous.appointments),
        revenue: computeDeltaPercent(current.revenue, previous.revenue),
        completionRate: current.completionRate - previous.completionRate,
        patients: computeDeltaPercent(current.patients, previous.patients),
      },
    };
  }, [appointments, dateRange.from, dateRange.to, doctorFilter, serviceFilter, statusFilter]);

  const alertSignals = useMemo(() => {
    const signals = [];

    if ((latestMonth?.completionRate ?? 0) < alertRules.minCompletionRate) {
      signals.push({
        key: 'completion',
        severity: 'high',
        title: 'Completion SLA risk',
        detail: `Completion rate ${latestMonth?.completionRate ?? 0}% is below target ${alertRules.minCompletionRate}%.`,
      });
    }

    if ((latestMonth?.cancellationRate ?? 0) > alertRules.maxCancellationRate) {
      signals.push({
        key: 'cancel',
        severity: 'medium',
        title: 'Cancellation drift',
        detail: `Cancellation rate ${latestMonth?.cancellationRate ?? 0}% exceeded cap ${alertRules.maxCancellationRate}%.`,
      });
    }

    if ((latestCohort?.retentionRate ?? 0) < alertRules.minRetentionRate) {
      signals.push({
        key: 'retention',
        severity: 'medium',
        title: 'Retention quality decline',
        detail: `Retention rate ${latestCohort?.retentionRate ?? 0}% below threshold ${alertRules.minRetentionRate}%.`,
      });
    }

    return signals;
  }, [latestMonth, latestCohort, alertRules]);

  const whatIfProjection = useMemo(() => {
    const baselineAppointments = latestMonth?.appointments || 0;
    const baselineRevenue = latestMonth?.revenue || 0;
    const projectedAppointments = Math.max(0, baselineAppointments + Number(simulator.extraAppointments || 0));
    const projectedRevenue = projectedAppointments * Number(simulator.avgFee || 0);
    const projectedCompletion = Math.min(100, Math.max(0, (latestMonth?.completionRate || 0) + Number(simulator.completionLift || 0)));

    return {
      baselineAppointments,
      baselineRevenue,
      projectedAppointments,
      projectedRevenue,
      projectedCompletion,
      revenueDelta: projectedRevenue - baselineRevenue,
    };
  }, [latestMonth, simulator]);

  const dataQuality = useMemo(() => {
    const total = filteredAppointments.length;
    if (!total) {
      return {
        score: 100,
        grade: 'A',
        missingService: 0,
        missingFee: 0,
        invalidDate: 0,
        duplicatePairs: 0,
        issues: [],
      };
    }

    const missingService = filteredAppointments.filter((a) => !String(a.service || '').trim()).length;
    const missingFee = filteredAppointments.filter((a) => Number(a.fee || 0) <= 0).length;
    const invalidDate = filteredAppointments.filter((a) => Number.isNaN(new Date(a.date).getTime())).length;

    const keyCount = new Map();
    filteredAppointments.forEach((a) => {
      const key = `${a.patient}__${a.doctor}__${a.date}`;
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    });
    const duplicatePairs = Array.from(keyCount.values()).filter((count) => count > 1).length;

    const weightedErrorRate = (
      (missingService / total) * 0.35 +
      (missingFee / total) * 0.35 +
      (invalidDate / total) * 0.2 +
      (duplicatePairs / total) * 0.1
    );

    const score = Math.round(clamp(100 - weightedErrorRate * 100, 0, 100));
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';

    const issues = [];
    if (missingService) issues.push(`${missingService} appointment(s) missing service label.`);
    if (missingFee) issues.push(`${missingFee} appointment(s) have missing or zero fee.`);
    if (invalidDate) issues.push(`${invalidDate} appointment(s) contain invalid date format.`);
    if (duplicatePairs) issues.push(`${duplicatePairs} duplicate patient-doctor-date pair(s) detected.`);
    if (!issues.length) issues.push('Dataset is clean under current quality rules.');

    return { score, grade, missingService, missingFee, invalidDate, duplicatePairs, issues };
  }, [filteredAppointments]);

  const autonomousPlaybook = useMemo(() => {
    const items = [];

    if ((latestMonth?.completionRate ?? 0) < 80) {
      items.push({
        key: 'completion',
        priority: 'P1',
        title: 'Boost completion pipeline',
        impact: 'Expected +4pt completion in 2-4 weeks',
        action: 'Apply 30-day view and focus incomplete journeys for follow-up reminders.',
      });
    }

    if ((latestMonth?.cancellationRate ?? 0) > 25) {
      items.push({
        key: 'cancellation',
        priority: 'P1',
        title: 'Cancellation containment sprint',
        impact: 'Expected -6% cancellation when no-show protocol is active',
        action: 'Target high-risk slots, add confirmation touchpoint 24h before visit.',
      });
    }

    if ((latestCohort?.retentionRate ?? 0) < 35) {
      items.push({
        key: 'retention',
        priority: 'P2',
        title: 'Retention rescue for chronic cohorts',
        impact: 'Expected +8% returning patients next cycle',
        action: 'Run post-visit education and telehealth recall workflow.',
      });
    }

    if (anomalySignals.some((s) => s.severity === 'high')) {
      items.push({
        key: 'anomaly',
        priority: 'P1',
        title: 'Anomaly escalation board',
        impact: 'Reduce service overload and protect SLA',
        action: 'Rebalance doctors for anomalous service pairs this month.',
      });
    }

    if (dataQuality.score < 85) {
      items.push({
        key: 'quality',
        priority: 'P2',
        title: 'Data quality repair batch',
        impact: `Data trust score can improve from ${dataQuality.score} to 90+`,
        action: 'Resolve missing fee/service records before executive reporting.',
      });
    }

    if (!items.length) {
      items.push({
        key: 'stable',
        priority: 'P3',
        title: 'Maintain optimization mode',
        impact: 'Operations are stable under current thresholds',
        action: 'Keep monitoring and run weekly KPI checks.',
      });
    }

    return items.slice(0, 5);
  }, [latestMonth, latestCohort, anomalySignals, dataQuality.score]);

  const digitalTwinProjection = useMemo(() => {
    const doctorCount = Math.max(1, doctors.length || 1);
    const baselineAppointments = latestMonth?.appointments || filteredAppointments.length || 0;
    const baselineCompletion = latestMonth?.completionRate || 0;
    const baselineRevenue = latestMonth?.revenue || totalRevenue;

    const capacity = doctorCount * Number(digitalTwin.doctorHours || 0) * 0.82;
    const recoveredDemand = baselineAppointments * (Number(digitalTwin.noShowRate || 0) / 100) * 0.45;
    const telehealthBoost = baselineAppointments * (Number(digitalTwin.telehealthMix || 0) / 100) * 0.2;
    const automationBoost = baselineAppointments * (Number(digitalTwin.aiAutomation || 0) / 100) * 0.25;
    const projectedAppointments = Math.round(clamp(baselineAppointments + recoveredDemand + telehealthBoost + automationBoost, 0, capacity));

    const completionGain = Number(digitalTwin.aiAutomation || 0) * 0.12 + Number(digitalTwin.telehealthMix || 0) * 0.08;
    const projectedCompletion = Math.round(clamp(baselineCompletion + completionGain - Number(digitalTwin.noShowRate || 0) * 0.06, 0, 100));
    const revenuePerVisit = baselineAppointments ? baselineRevenue / baselineAppointments : Number(simulator.avgFee || 0);
    const projectedRevenue = Math.round(projectedAppointments * revenuePerVisit);
    const utilization = capacity ? Math.round((projectedAppointments / capacity) * 100) : 0;
    const bottleneck = clamp(utilization - 85, 0, 100);

    return {
      capacity: Math.round(capacity),
      projectedAppointments,
      projectedCompletion,
      projectedRevenue,
      utilization,
      bottleneck: Math.round(bottleneck),
      riskBand: bottleneck > 20 ? 'high' : bottleneck > 5 ? 'medium' : 'low',
    };
  }, [doctors.length, latestMonth, filteredAppointments.length, totalRevenue, digitalTwin, simulator.avgFee]);

  const autoScheduleRecommendations = useMemo(() => {
    const byDoctor = {};
    filteredAppointments.forEach((item) => {
      if (!byDoctor[item.doctor]) {
        byDoctor[item.doctor] = { total: 0, completed: 0, cancelled: 0, pending: 0, services: new Set() };
      }
      byDoctor[item.doctor].total += 1;
      if (item.status === 'completed') byDoctor[item.doctor].completed += 1;
      if (item.status === 'cancelled') byDoctor[item.doctor].cancelled += 1;
      if (item.status === 'pending') byDoctor[item.doctor].pending += 1;
      byDoctor[item.doctor].services.add(item.service || 'General');
    });

    return Object.entries(byDoctor)
      .map(([doctor, stat]) => {
        const completion = stat.total ? Math.round((stat.completed / stat.total) * 100) : 0;
        const cancelRate = stat.total ? Math.round((stat.cancelled / stat.total) * 100) : 0;
        const anomalyBoost = anomalySignals.some((a) => a.doctor === doctor && a.severity === 'high') ? 4 : 0;
        const recommendedSlots = Math.round(clamp(stat.total * 1.15 + stat.pending * 0.6 - cancelRate * 0.08 + anomalyBoost, 4, 42));
        const telehealthShare = Math.round(clamp(cancelRate * 0.7 + (completion < 75 ? 12 : 6), 8, 55));
        const followupBuffer = Math.round(clamp((100 - completion) / 3 + stat.pending * 0.5, 2, 20));
        const priorityScore = Math.round(clamp((100 - completion) * 0.5 + cancelRate * 0.8 + stat.pending * 2 + anomalyBoost * 3, 0, 100));

        return {
          doctor,
          completion,
          cancelRate,
          recommendedSlots,
          telehealthShare,
          followupBuffer,
          priorityScore,
          serviceFocus: Array.from(stat.services).slice(0, 2).join(', '),
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 8);
  }, [filteredAppointments, anomalySignals]);

  const patientRiskTrajectory = useMemo(() => {
    const grouped = {};
    filteredAppointments.forEach((item) => {
      const month = monthKey(item.date);
      if (!grouped[month]) grouped[month] = { month, high: 0, medium: 0, low: 0 };
      const risk = inferPatientRiskBand(item);
      grouped[month][risk] += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => {
        const total = row.high + row.medium + row.low;
        return {
          ...row,
          riskPressure: total ? Math.round((row.high / total) * 100) : 0,
        };
      });
  }, [filteredAppointments]);

  const precisionCareRows = useMemo(() => {
    const grouped = {};
    filteredAppointments.forEach((item) => {
      const patient = item.patient || 'Unknown Patient';
      if (!grouped[patient]) {
        grouped[patient] = {
          patient,
          appointments: 0,
          completed: 0,
          cancelled: 0,
          pending: 0,
          totalFee: 0,
          lastDate: '',
          lastService: 'General Service',
          lastDoctor: 'Unknown Doctor',
        };
      }
      const row = grouped[patient];
      row.appointments += 1;
      row.totalFee += Number(item.fee || 0);
      if (item.status === 'completed') row.completed += 1;
      if (item.status === 'cancelled') row.cancelled += 1;
      if (item.status === 'pending' || item.status === 'booked') row.pending += 1;

      if (!row.lastDate || String(item.date || '') > row.lastDate) {
        row.lastDate = String(item.date || '');
        row.lastService = item.service || 'General Service';
        row.lastDoctor = item.doctor || 'Unknown Doctor';
      }
    });

    const now = new Date();
    return Object.values(grouped).map((row) => {
      const avgFee = row.appointments ? Math.round(row.totalFee / row.appointments) : 0;
      const completionRate = row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0;

      const lastDate = row.lastDate ? new Date(row.lastDate) : null;
      const careGapDays = lastDate && !Number.isNaN(lastDate.getTime())
        ? Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / 86400000))
        : 0;

      const serviceRisk = /cardio|neuro|onc|resp/i.test(row.lastService) ? 12 : 4;
      const gapRisk = careGapDays > 60 ? 20 : careGapDays > 30 ? 12 : 4;
      const riskScore = Math.round(clamp(
        row.cancelled * 22 + row.pending * 14 + gapRisk + serviceRisk + (avgFee > 250000 ? 8 : 4),
        0,
        100
      ));

      const riskBand = riskScore >= 70 ? 'high' : riskScore >= 45 ? 'medium' : 'low';
      const nextBestAction = riskBand === 'high'
        ? 'Activate nurse outreach + telehealth follow-up in 24h'
        : riskBand === 'medium'
          ? 'Send adherence reminder and schedule next checkpoint'
          : 'Keep preventive care cadence and monitor monthly';

      return {
        ...row,
        avgFee,
        completionRate,
        careGapDays,
        riskScore,
        riskBand,
        nextBestAction,
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [filteredAppointments]);

  const precisionTwinSummary = useMemo(() => {
    if (!precisionCareRows.length) {
      return {
        highRiskPatients: 0,
        mediumRiskPatients: 0,
        averageRiskScore: 0,
      };
    }

    const highRiskPatients = precisionCareRows.filter((row) => row.riskBand === 'high').length;
    const mediumRiskPatients = precisionCareRows.filter((row) => row.riskBand === 'medium').length;
    const averageRiskScore = Math.round(
      precisionCareRows.reduce((sum, row) => sum + row.riskScore, 0) / precisionCareRows.length
    );

    return { highRiskPatients, mediumRiskPatients, averageRiskScore };
  }, [precisionCareRows]);

  const remoteMonitoringCohort = useMemo(() => {
    return precisionCareRows.slice(0, 6).map((row, index) => {
      const deviceUptime = Math.round(clamp(97 - index * 3 - row.riskScore * 0.12, 70, 99));
      const adherence = Math.round(clamp(93 - index * 4 - row.riskScore * 0.15 + row.completionRate * 0.05, 52, 99));
      const alertLevel = row.riskBand === 'high' ? 'high' : adherence < 70 ? 'medium' : 'low';
      const liveSignal = row.riskBand === 'high'
        ? 'Heart-rate variance + BP drift'
        : row.riskBand === 'medium'
          ? 'Medication adherence drop'
          : 'Stable telemetry pattern';
      return {
        patient: row.patient,
        riskBand: row.riskBand,
        deviceUptime,
        adherence,
        alertLevel,
        liveSignal,
        nextCheckinHours: row.riskBand === 'high' ? 6 : row.riskBand === 'medium' ? 18 : 48,
      };
    });
  }, [precisionCareRows]);

  const remoteMonitoringAlerts = useMemo(() => {
    return remoteMonitoringCohort
      .filter((row) => row.alertLevel !== 'low')
      .map((row, index) => ({
        id: `${row.patient}-${index}`,
        patient: row.patient,
        severity: row.alertLevel,
        signal: row.liveSignal,
        action: row.alertLevel === 'high'
          ? 'Escalate to rapid response virtual clinic'
          : 'Issue adherence coaching and pharmacist callback',
      }));
  }, [remoteMonitoringCohort]);

  const clinicalPathwayRows = useMemo(() => {
    const grouped = {};
    filteredAppointments.forEach((item) => {
      const service = item.service || 'General Service';
      if (!grouped[service]) {
        grouped[service] = {
          service,
          appointments: 0,
          completed: 0,
          cancelled: 0,
          pending: 0,
          avgFee: 0,
          totalFee: 0,
        };
      }
      const row = grouped[service];
      row.appointments += 1;
      row.totalFee += Number(item.fee || 0);
      if (item.status === 'completed') row.completed += 1;
      if (item.status === 'cancelled') row.cancelled += 1;
      if (item.status === 'pending' || item.status === 'booked') row.pending += 1;
    });

    return Object.values(grouped).map((row) => {
      const completionRate = row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0;
      const cancellationRate = row.appointments ? Math.round((row.cancelled / row.appointments) * 100) : 0;
      const automationCoverage = Math.round(clamp(completionRate * 0.55 + (100 - cancellationRate) * 0.45, 0, 100));
      const telehealthFit = Math.round(clamp(
        /cardio|resp|general|derma/i.test(row.service) ? 72 : 54,
        0,
        100
      ));
      const pathwayMaturity = Math.round(clamp(
        automationCoverage * 0.45 + telehealthFit * 0.25 + completionRate * 0.3,
        0,
        100
      ));
      return {
        ...row,
        avgFee: row.appointments ? Math.round(row.totalFee / row.appointments) : 0,
        completionRate,
        cancellationRate,
        automationCoverage,
        telehealthFit,
        pathwayMaturity,
      };
    }).sort((a, b) => b.pathwayMaturity - a.pathwayMaturity);
  }, [filteredAppointments]);

  const fhirSubscriptionFeed = useMemo(() => {
    return [...filteredAppointments]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 14)
      .map((item, index) => {
        const status = String(item.status || '').toLowerCase();
        const eventType = status === 'cancelled'
          ? 'Appointment.cancelled'
          : status === 'pending' || status === 'booked'
            ? 'Appointment.booked'
            : 'Appointment.completed';
        const severity = status === 'cancelled' ? 'high' : status === 'pending' ? 'medium' : 'low';
        const offsetMinutes = index * 11;
        const eventTime = new Date(Date.now() - offsetMinutes * 60000).toISOString();
        return {
          id: `${item.id || index}-${eventType}`,
          eventTime,
          topic: 'hl7.fhir.subscription.appointment',
          eventType,
          patient: item.patient,
          doctor: item.doctor,
          service: item.service,
          severity,
          payloadRef: `Appointment/${item.id || index}`,
        };
      });
  }, [filteredAppointments]);

  const replayFeedEvents = useMemo(() => {
    if (!feedReplayActive) return fhirSubscriptionFeed;
    const cursor = Math.max(1, Math.min(feedReplayCursor, fhirSubscriptionFeed.length || 1));
    return fhirSubscriptionFeed.slice(0, cursor);
  }, [feedReplayActive, feedReplayCursor, fhirSubscriptionFeed]);

  const digitalTherapeuticsPrograms = useMemo(() => {
    const weights = dtxPolicy?.sessionWeights || DEFAULT_DTX_POLICY.sessionWeights;
    const thresholds = dtxPolicy?.riskThresholds || DEFAULT_DTX_POLICY.riskThresholds;
    const gainOffset = Number(dtxPolicy?.expectedGainOffset ?? DEFAULT_DTX_POLICY.expectedGainOffset);
    const gainClampMin = Number(dtxPolicy?.expectedGainClamp?.min ?? DEFAULT_DTX_POLICY.expectedGainClamp.min);
    const gainClampMax = Number(dtxPolicy?.expectedGainClamp?.max ?? DEFAULT_DTX_POLICY.expectedGainClamp.max);

    return precisionCareRows.slice(0, 10).map((row, index) => {
      const protocol = /cardio/i.test(row.lastService)
        ? 'Cardio Lifestyle Protocol'
        : /resp/i.test(row.lastService)
          ? 'Respiratory Adherence Protocol'
          : 'Preventive Care Protocol';
      const sessionCompletion = Math.round(clamp(row.completionRate - index * 2 + (100 - row.riskScore) * 0.12, 35, 99));
      const digitalEngagement = Math.round(clamp(84 - row.careGapDays * 0.35 - row.cancelled * 7 + row.completed * 3, 20, 99));
      const aiCoachIntensity = row.riskScore >= thresholds.high
        ? 'intensive'
        : row.riskScore >= thresholds.medium
          ? 'guided'
          : 'maintenance';
      const weightedScore =
        sessionCompletion * Number(weights.completion || 0) +
        digitalEngagement * Number(weights.engagement || 0) +
        (100 - row.riskScore) * Number(weights.riskInverse || 0);
      const expectedOutcomeGain = Math.round(clamp(weightedScore - gainOffset, gainClampMin, gainClampMax));
      return {
        patient: row.patient,
        protocol,
        sessionCompletion,
        digitalEngagement,
        aiCoachIntensity,
        expectedOutcomeGain,
      };
    });
  }, [precisionCareRows, dtxPolicy]);

  const populationStratification = useMemo(() => {
    const segments = {
      critical: { segment: 'Critical Care Gap', patients: 0, avgRisk: 0, engagement: 0, interventions: '24h nurse outreach + physician review' },
      rising: { segment: 'Rising Risk', patients: 0, avgRisk: 0, engagement: 0, interventions: '48h telehealth check-in + medication coach' },
      stable: { segment: 'Stable Prevention', patients: 0, avgRisk: 0, engagement: 0, interventions: 'Monthly prevention nudges + annual review' },
    };

    const riskBuckets = {
      critical: [],
      rising: [],
      stable: [],
    };

    precisionCareRows.forEach((row) => {
      const segmentKey = row.riskScore >= 70 ? 'critical' : row.riskScore >= 45 ? 'rising' : 'stable';
      riskBuckets[segmentKey].push(row);
    });

    Object.entries(riskBuckets).forEach(([key, rows]) => {
      segments[key].patients = rows.length;
      if (!rows.length) return;
      segments[key].avgRisk = Math.round(rows.reduce((sum, row) => sum + row.riskScore, 0) / rows.length);
      segments[key].engagement = Math.round(clamp(
        rows.reduce((sum, row) => sum + (row.completionRate - row.cancelled * 5), 0) / rows.length,
        0,
        100
      ));
    });

    return [segments.critical, segments.rising, segments.stable];
  }, [precisionCareRows]);

  const outreachQueue = useMemo(() => {
    return populationStratification
      .filter((segment) => segment.patients > 0)
      .map((segment, index) => {
        const etaHours = segment.segment === 'Critical Care Gap' ? 6 : segment.segment === 'Rising Risk' ? 24 : 72;
        const severity = segment.segment === 'Critical Care Gap' ? 'high' : segment.segment === 'Rising Risk' ? 'medium' : 'low';
        return {
          id: `${segment.segment}-${index}`,
          segment: segment.segment,
          patients: segment.patients,
          severity,
          etaHours,
          intervention: segment.interventions,
        };
      });
  }, [populationStratification]);

  const outreachCapacityPlan = useMemo(() => {
    const totalStaff = Number(outreachCapacity.careManagers || 0) + Number(outreachCapacity.nurses || 0);
    const contactsPerDay = totalStaff * Number(outreachCapacity.dailyContactsPerStaff || 0);
    const urgentSlots = Number(outreachCapacity.urgentSlotsPerDay || 0);
    const queueLoad = outreachQueue.reduce((sum, item) => sum + Number(item.patients || 0), 0);
    const daysToClear = contactsPerDay > 0 ? Math.ceil(queueLoad / contactsPerDay) : 0;
    const urgentDemand = outreachQueue
      .filter((item) => item.severity === 'high')
      .reduce((sum, item) => sum + Number(item.patients || 0), 0);

    return {
      totalStaff,
      contactsPerDay,
      urgentSlots,
      queueLoad,
      daysToClear,
      urgentDemand,
      urgentOverflow: Math.max(0, urgentDemand - urgentSlots),
    };
  }, [outreachQueue, outreachCapacity]);

  const outreachSlaForecast = useMemo(() => {
    if (!outreachQueue.length) return [];

    const contactsPerDay = Math.max(0, Number(outreachCapacityPlan.contactsPerDay || 0));
    const severityWeight = { high: 3, medium: 2, low: 1 };
    const totalWeight = outreachQueue.reduce((sum, row) => sum + (severityWeight[row.severity] || 1), 0) || 1;

    return outreachQueue.map((row) => {
      const allocatedContactsPerDay = contactsPerDay * ((severityWeight[row.severity] || 1) / totalWeight);
      const projectedHours = allocatedContactsPerDay > 0
        ? Math.ceil((Number(row.patients || 0) / allocatedContactsPerDay) * 24)
        : 0;
      const breachHours = projectedHours > 0 ? Math.max(0, projectedHours - Number(row.etaHours || 0)) : 0;
      const breachRisk = breachHours === 0
        ? 'low'
        : breachHours >= 24 || row.severity === 'high'
          ? 'high'
          : 'medium';

      return {
        ...row,
        projectedHours,
        breachHours,
        breachRisk,
      };
    }).sort((a, b) => b.breachHours - a.breachHours);
  }, [outreachQueue, outreachCapacityPlan.contactsPerDay]);

  const outreachRebalancePlan = useMemo(() => {
    const dailyContactsPerStaff = Math.max(1, Number(outreachCapacity.dailyContactsPerStaff || 1));

    const requiredContactsPerDay = outreachSlaForecast.reduce((sum, row) => {
      if (!row.breachHours || !row.etaHours) return sum;
      return sum + (Number(row.patients || 0) * 24) / Number(row.etaHours || 1);
    }, 0);

    const contactDeficit = Math.max(0, Math.ceil(requiredContactsPerDay - Number(outreachCapacityPlan.contactsPerDay || 0)));
    const additionalStaff = Math.max(0, Math.ceil(contactDeficit / dailyContactsPerStaff));
    const additionalUrgentSlots = Math.max(0, Number(outreachCapacityPlan.urgentOverflow || 0));

    return {
      contactDeficit,
      additionalStaff,
      additionalUrgentSlots,
      projectedBreaches: outreachSlaForecast.filter((row) => row.breachHours > 0).length,
    };
  }, [outreachSlaForecast, outreachCapacity.dailyContactsPerStaff, outreachCapacityPlan.contactsPerDay, outreachCapacityPlan.urgentOverflow]);

  const outreachRebalanceCandidate = useMemo(() => {
    const addStaff = Number(outreachRebalancePlan.additionalStaff || 0);
    const addUrgent = Number(outreachRebalancePlan.additionalUrgentSlots || 0);
    const addCareManagers = Math.ceil(addStaff * 0.35);
    const addNurses = Math.max(0, addStaff - addCareManagers);

    return {
      addCareManagers,
      addNurses,
      addUrgentSlots: addUrgent,
      nextCapacity: {
        careManagers: Number(outreachCapacity.careManagers || 0) + addCareManagers,
        nurses: Number(outreachCapacity.nurses || 0) + addNurses,
        dailyContactsPerStaff: Number(outreachCapacity.dailyContactsPerStaff || 0),
        urgentSlotsPerDay: Number(outreachCapacity.urgentSlotsPerDay || 0) + addUrgent,
      },
    };
  }, [outreachRebalancePlan.additionalStaff, outreachRebalancePlan.additionalUrgentSlots, outreachCapacity]);

  const dtxPolicyDiffRows = useMemo(() => {
    const baseline = selectedDtxPolicyCompareId
      ? dtxPolicyHistory.find((item) => item.id === selectedDtxPolicyCompareId)?.policy
      : DEFAULT_DTX_POLICY;

    if (!baseline) return [];

    const entries = [
      {
        field: 'sessionWeights.completion',
        baseline: Number(baseline.sessionWeights?.completion ?? 0),
        current: Number(dtxPolicy.sessionWeights?.completion ?? 0),
      },
      {
        field: 'sessionWeights.engagement',
        baseline: Number(baseline.sessionWeights?.engagement ?? 0),
        current: Number(dtxPolicy.sessionWeights?.engagement ?? 0),
      },
      {
        field: 'sessionWeights.riskInverse',
        baseline: Number(baseline.sessionWeights?.riskInverse ?? 0),
        current: Number(dtxPolicy.sessionWeights?.riskInverse ?? 0),
      },
      {
        field: 'riskThresholds.high',
        baseline: Number(baseline.riskThresholds?.high ?? 0),
        current: Number(dtxPolicy.riskThresholds?.high ?? 0),
      },
      {
        field: 'riskThresholds.medium',
        baseline: Number(baseline.riskThresholds?.medium ?? 0),
        current: Number(dtxPolicy.riskThresholds?.medium ?? 0),
      },
      {
        field: 'expectedGainOffset',
        baseline: Number(baseline.expectedGainOffset ?? 0),
        current: Number(dtxPolicy.expectedGainOffset ?? 0),
      },
      {
        field: 'expectedGainClamp.min',
        baseline: Number(baseline.expectedGainClamp?.min ?? 0),
        current: Number(dtxPolicy.expectedGainClamp?.min ?? 0),
      },
      {
        field: 'expectedGainClamp.max',
        baseline: Number(baseline.expectedGainClamp?.max ?? 0),
        current: Number(dtxPolicy.expectedGainClamp?.max ?? 0),
      },
    ];

    return entries.map((row) => ({
      ...row,
      delta: Number((row.current - row.baseline).toFixed(3)),
      changed: row.current !== row.baseline,
    }));
  }, [selectedDtxPolicyCompareId, dtxPolicyHistory, dtxPolicy]);

  const appendGovernanceAudit = useCallback((action, detail) => {
    setGovernanceAuditTrail((prev) => [
      {
        id: `gov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        action,
        detail,
      },
      ...prev,
    ].slice(0, 40));
  }, []);

  const clinicBenchmarkRows = useMemo(() => {
    const clinicNames = ['North Hub', 'Central Care', 'East Telehealth'];
    const grouped = clinicNames.reduce((acc, name) => {
      acc[name] = {
        clinic: name,
        appointments: 0,
        revenue: 0,
        completed: 0,
        cancelled: 0,
        patientCounts: new Map(),
      };
      return acc;
    }, {});

    filteredAppointments.forEach((item) => {
      const seed = hashString(`${item.doctor}|${item.service}`);
      const clinic = clinicNames[seed % clinicNames.length];
      const row = grouped[clinic];
      row.appointments += 1;
      row.revenue += Number(item.fee || 0);
      if (item.status === 'completed') row.completed += 1;
      if (item.status === 'cancelled') row.cancelled += 1;
      row.patientCounts.set(item.patient, (row.patientCounts.get(item.patient) || 0) + 1);
    });

    return Object.values(grouped)
      .map((row) => {
        const uniquePatients = row.patientCounts.size;
        const returningPatients = Array.from(row.patientCounts.values()).filter((v) => v > 1).length;
        const completion = row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0;
        const cancellation = row.appointments ? Math.round((row.cancelled / row.appointments) * 100) : 0;
        const retention = uniquePatients ? Math.round((returningPatients / uniquePatients) * 100) : 0;
        const healthIndex = Math.round(clamp(completion * 0.45 + (100 - cancellation) * 0.3 + retention * 0.25, 0, 100));
        return {
          clinic: row.clinic,
          appointments: row.appointments,
          revenue: row.revenue,
          completion,
          cancellation,
          retention,
          healthIndex,
        };
      })
      .sort((a, b) => b.healthIndex - a.healthIndex);
  }, [filteredAppointments]);

  const executiveSnapshot = useMemo(() => {
    const completion = latestMonth?.completionRate ?? 0;
    const cancellation = latestMonth?.cancellationRate ?? 0;
    const retention = latestCohort?.retentionRate ?? 0;
    const anomalyWeight = anomalySignals.filter((a) => a.severity === 'high').length * 8;

    const riskIndex = Math.round(clamp((100 - completion) * 0.4 + cancellation * 0.35 + (100 - retention) * 0.25 + anomalyWeight, 0, 100));
    const growthIndex = Math.round(clamp(completion * 0.35 + retention * 0.35 + (comparisonMetrics.deltas.revenue + 100) * 0.15 + (100 - cancellation) * 0.15, 0, 100));
    const executionIndex = Math.round(clamp((100 - riskIndex) * 0.5 + growthIndex * 0.5, 0, 100));

    const topFocus = autonomousPlaybook[0]?.title || 'Keep baseline monitoring active';
    const decision = riskIndex >= 65 ? 'Contain risk now' : growthIndex >= 70 ? 'Scale growth scenario' : 'Maintain balanced mode';

    return {
      riskIndex,
      growthIndex,
      executionIndex,
      topFocus,
      decision,
    };
  }, [latestMonth, latestCohort, anomalySignals, comparisonMetrics.deltas.revenue, autonomousPlaybook]);

  const scenarioComparisons = useMemo(() => {
    const baselineAppointments = latestMonth?.appointments || 0;
    const baselineRevenue = latestMonth?.revenue || 0;
    const baselineCompletion = latestMonth?.completionRate || 0;

    const build = (id, name, appointmentsLift, revenueLift, completionLift, riskShift) => {
      const projectedAppointments = Math.round(clamp(baselineAppointments * (1 + appointmentsLift / 100), 0, baselineAppointments + 180));
      const projectedRevenue = Math.round(clamp(baselineRevenue * (1 + revenueLift / 100), 0, baselineRevenue + 200000000));
      const projectedCompletion = Math.round(clamp(baselineCompletion + completionLift, 0, 100));
      const projectedRisk = Math.round(clamp(executiveSnapshot.riskIndex + riskShift, 0, 100));
      const score = Math.round(clamp(projectedCompletion * 0.4 + (100 - projectedRisk) * 0.35 + (projectedRevenue > 0 && baselineRevenue > 0 ? (projectedRevenue / baselineRevenue) * 25 : 12), 0, 100));
      return { id, name, projectedAppointments, projectedRevenue, projectedCompletion, projectedRisk, score };
    };

    return [
      build('growth', 'Growth Acceleration', 22, 26, 6, 8),
      build('retention', 'Retention Rescue', 14, 12, 10, -6),
      build('efficiency', 'Efficiency Maximizer', 10, 14, 12, -10),
    ];
  }, [latestMonth, executiveSnapshot.riskIndex]);

  const aiBriefing = useMemo(() => {
    const bestScenario = [...scenarioComparisons].sort((a, b) => b.score - a.score)[0];
    const lines = [];
    lines.push(`Operating mode: ${executiveSnapshot.decision}.`);
    lines.push(`Current risk index is ${executiveSnapshot.riskIndex}, execution readiness ${executiveSnapshot.executionIndex}.`);
    lines.push(`Primary tactical focus: ${executiveSnapshot.topFocus}.`);
    if (bestScenario) {
      lines.push(`Best near-term scenario: ${bestScenario.name} (score ${bestScenario.score}) with projected completion ${bestScenario.projectedCompletion}%.`);
    }
    lines.push(`Data trust stands at ${dataQuality.score}/100 and should be monitored before executive rollout.`);
    return lines;
  }, [executiveSnapshot, scenarioComparisons, dataQuality.score]);

  const scenarioDriftAlerts = useMemo(() => {
    if (scenarioHistory.length < 2) return [];

    const grouped = scenarioHistory.reduce((acc, row) => {
      if (!acc[row.scenarioId]) acc[row.scenarioId] = [];
      acc[row.scenarioId].push(row);
      return acc;
    }, {});

    const alerts = [];
    Object.entries(grouped).forEach(([, rows]) => {
      if (rows.length < 2) return;
      const latest = rows[0];
      const previous = rows[1];
      const scoreDelta = Number(latest.score || 0) - Number(previous.score || 0);
      const revenueDelta = Number(latest.projectedRevenue || 0) - Number(previous.projectedRevenue || 0);

      if (scoreDelta <= -6 || revenueDelta <= -5000000) {
        alerts.push({
          scenario: latest.name,
          scoreDelta,
          revenueDelta,
          severity: scoreDelta <= -10 ? 'high' : 'medium',
          latestAt: latest.timestamp,
        });
      }
    });

    return alerts;
  }, [scenarioHistory]);

  const weeklyBriefingTemplate = useMemo(() => {
    const latestRiskPressure = patientRiskTrajectory[patientRiskTrajectory.length - 1]?.riskPressure ?? 0;
    const bestScenario = [...scenarioComparisons].sort((a, b) => b.score - a.score)[0];

    return {
      period: `Week of ${formatDateByOptions(new Date(), { month: 'short', day: 'numeric', year: 'numeric' })}`,
      keyWins: [
        `Completion trend currently at ${latestMonth?.completionRate ?? 0}% with execution readiness ${executiveSnapshot.executionIndex}.`,
        `Cohort retention tracked at ${latestCohort?.retentionRate ?? 0}% and best strategy candidate is ${bestScenario?.name || 'TBD'}.`,
      ],
      keyRisks: [
        `Operational risk index remains ${executiveSnapshot.riskIndex}; anomaly watchlist contains ${anomalySignals.length} active signal(s).`,
        `Risk pressure in patient trajectory is ${latestRiskPressure}% for the latest month.`,
      ],
      nextActions: [
        `Execute ${bestScenario?.name || 'selected scenario'} and track delta in 7 days.`,
        'Review data quality issues before leadership sync and regenerate board export.',
      ],
    };
  }, [patientRiskTrajectory, scenarioComparisons, latestMonth, executiveSnapshot, latestCohort, anomalySignals.length]);

  const autoBriefText = useMemo(() => {
    const lines = [
      `[Executive Brief] ${weeklyBriefingTemplate.period}`,
      ...aiBriefing.map((line, idx) => `${idx + 1}. ${line}`),
      '---',
      `Risk Index: ${executiveSnapshot.riskIndex} | Execution: ${executiveSnapshot.executionIndex}`,
      `Data Trust: ${dataQuality.score}/100`,
      `Anomaly Signals: ${anomalySignals.length}`,
    ];
    return lines.join('\n');
  }, [weeklyBriefingTemplate.period, aiBriefing, executiveSnapshot.riskIndex, executiveSnapshot.executionIndex, dataQuality.score, anomalySignals.length]);

  const driftTrendSeries = useMemo(() => {
    return [...scenarioHistory]
      .reverse()
      .map((item, idx) => ({
        run: idx + 1,
        label: `#${idx + 1}`,
        score: Number(item.score || 0),
        revenueK: Math.round(Number(item.projectedRevenue || 0) / 1000),
      }));
  }, [scenarioHistory]);

  const driftRootCauses = useMemo(() => {
    const causes = [];
    const highDriftCount = scenarioDriftAlerts.filter((item) => item.severity === 'high').length;
    const mediumDriftCount = scenarioDriftAlerts.filter((item) => item.severity === 'medium').length;

    if (highDriftCount || mediumDriftCount) {
      const impact = clamp(highDriftCount * 24 + mediumDriftCount * 12, 10, 98);
      causes.push({
        key: 'scenario-instability',
        factor: 'Scenario instability across recent runs',
        signal: `${highDriftCount} high-severity and ${mediumDriftCount} medium-severity drift alerts.`,
        impact,
        action: 'Freeze growth experiments for 7 days and prioritize stabilization scenarios.',
      });
    }

    autoScheduleRecommendations.slice(0, 3).forEach((item) => {
      if (item.cancelRate >= 26 || item.completion <= 74) {
        const impact = clamp(Math.round(item.cancelRate * 1.4 + (75 - item.completion) * 1.1 + item.priorityScore * 0.35), 20, 95);
        causes.push({
          key: `doctor-${item.doctor}`,
          factor: `Doctor flow pressure: ${item.doctor}`,
          signal: `Cancel ${item.cancelRate}% | Completion ${item.completion}% | Pending buffer ${item.followupBuffer}.`,
          impact,
          action: `Rebalance ${item.doctor} slots and enable ${item.telehealthShare}% telehealth overflow for this week.`,
        });
      }
    });

    const servicePressure = anomalySignals.reduce((acc, item) => {
      const key = item.service || 'General';
      if (!acc[key]) {
        acc[key] = { service: key, total: 0, high: 0 };
      }
      acc[key].total += 1;
      if (item.severity === 'high') acc[key].high += 1;
      return acc;
    }, {});

    Object.values(servicePressure).forEach((item) => {
      const impact = clamp(item.total * 15 + item.high * 20, 18, 92);
      if (impact >= 30) {
        causes.push({
          key: `service-${item.service}`,
          factor: `Service volatility: ${item.service}`,
          signal: `${item.total} anomaly signal(s), ${item.high} high-severity.`,
          impact,
          action: `Create overflow triage protocol for ${item.service} and monitor daily throughput.`,
        });
      }
    });

    if (dataQuality.score < 88) {
      causes.push({
        key: 'data-trust',
        factor: 'Data trust drag in executive metrics',
        signal: `Quality score is ${dataQuality.score}/100, causing uncertainty in scenario tuning.`,
        impact: clamp(Math.round((90 - dataQuality.score) * 3.5), 12, 84),
        action: 'Run data repair checklist first, then re-baseline all scenarios.',
      });
    }

    if (!causes.length) {
      causes.push({
        key: 'stable-mode',
        factor: 'No critical drift root-cause detected',
        signal: 'Recent trend is stable across score and revenue trajectory.',
        impact: 8,
        action: 'Continue weekly monitoring cadence and keep scenario cadence unchanged.',
      });
    }

    return causes.sort((a, b) => b.impact - a.impact).slice(0, 6);
  }, [scenarioDriftAlerts, autoScheduleRecommendations, anomalySignals, dataQuality.score]);

  const recoveryPlan = useMemo(() => {
    return driftRootCauses.slice(0, 4).map((item, idx) => ({
      id: `${item.key}-${idx}`,
      title: item.factor,
      owner: idx === 0 ? 'Ops Lead' : idx === 1 ? 'Scheduling Team' : idx === 2 ? 'Medical Director' : 'Data Steward',
      eta: idx === 0 ? '24h' : idx === 1 ? '48h' : idx === 2 ? '72h' : '3-5 days',
      expectedLift: `-${Math.max(2, Math.round(item.impact * 0.12))} risk points`,
      task: item.action,
    }));
  }, [driftRootCauses]);

  const complianceChecks = useMemo(() => {
    const highAnomalies = anomalySignals.filter((item) => item.severity === 'high').length;
    const highDrift = scenarioDriftAlerts.filter((item) => item.severity === 'high').length;

    const hipaaScore = Math.round(clamp(dataQuality.score * 0.62 + (100 - highAnomalies * 12) * 0.23 + (100 - highDrift * 14) * 0.15, 0, 100));
    const gdprScore = Math.round(clamp(dataQuality.score * 0.68 + (100 - anomalySignals.length * 5) * 0.2 + executiveSnapshot.executionIndex * 0.12, 0, 100));
    const iso27001Score = Math.round(clamp(dataQuality.score * 0.45 + executiveSnapshot.executionIndex * 0.35 + (100 - executiveSnapshot.riskIndex) * 0.2, 0, 100));

    const build = (id, framework, score, owner, controlFocus, evidence) => ({
      id,
      framework,
      score,
      owner,
      controlFocus,
      evidence,
      level: score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 70 ? 'Watch' : 'Critical',
    });

    return [
      build('hipaa', 'HIPAA Security Rule', hipaaScore, 'Compliance Lead', 'Access audit + least privilege', `${highAnomalies} high anomaly signal(s), data trust ${dataQuality.score}/100.`),
      build('gdpr', 'GDPR Data Governance', gdprScore, 'Data Protection Officer', 'Purpose limitation + retention policy', `${anomalySignals.length} anomaly signal(s), execution index ${executiveSnapshot.executionIndex}.`),
      build('iso', 'ISO 27001 Controls', iso27001Score, 'Security Operations', 'Risk treatment + monitoring cadence', `Risk index ${executiveSnapshot.riskIndex}, drift alerts ${scenarioDriftAlerts.length}.`),
    ];
  }, [anomalySignals, scenarioDriftAlerts, dataQuality.score, executiveSnapshot.executionIndex, executiveSnapshot.riskIndex]);

  const fhirBundle = useMemo(() => {
    const patientRefs = new Map();
    const practitionerRefs = new Map();
    const patientEntries = [];
    const practitionerEntries = [];
    const encounterEntries = [];
    const appointmentEntries = [];

    filteredAppointments.slice(0, 200).forEach((item) => {
      const patientName = item.patient || 'Unknown Patient';
      const doctorName = item.doctor || 'Unknown Doctor';
      const serviceName = item.service || 'General Service';
      const appointmentId = `appointment-${item.id || hashString(`${patientName}-${item.date}-${serviceName}`)}`;
      const encounterId = `encounter-${item.id || hashString(`${appointmentId}-${doctorName}`)}`;
      const date = toDateOnly(item.date);
      const startIso = date ? new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString() : null;

      if (!patientRefs.has(patientName)) {
        const id = `patient-${hashString(patientName)}`;
        patientRefs.set(patientName, id);
        patientEntries.push({
          fullUrl: `urn:uuid:${id}`,
          resource: {
            resourceType: 'Patient',
            id,
            meta: {
              profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
            },
            identifier: [{
              system: 'https://clinic.local/patient-registry',
              value: patientName,
            }],
            name: [{ text: patientName }],
          },
        });
      }

      if (!practitionerRefs.has(doctorName)) {
        const id = `practitioner-${hashString(doctorName)}`;
        practitionerRefs.set(doctorName, id);
        practitionerEntries.push({
          fullUrl: `urn:uuid:${id}`,
          resource: {
            resourceType: 'Practitioner',
            id,
            meta: {
              profile: ['http://hl7.org/fhir/StructureDefinition/Practitioner'],
            },
            identifier: [{
              system: 'https://clinic.local/staff-registry',
              value: doctorName,
            }],
            name: [{ text: doctorName }],
          },
        });
      }

      const patientRef = patientRefs.get(patientName);
      const practitionerRef = practitionerRefs.get(doctorName);

      encounterEntries.push({
        fullUrl: `urn:uuid:${encounterId}`,
        resource: {
          resourceType: 'Encounter',
          id: encounterId,
          status: item.status === 'cancelled' ? 'cancelled' : item.status === 'completed' ? 'finished' : 'planned',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory',
          },
          subject: { reference: `Patient/${patientRef}` },
          participant: [{ individual: { reference: `Practitioner/${practitionerRef}` } }],
          period: startIso ? { start: startIso } : undefined,
          serviceType: { text: serviceName },
        },
      });

      appointmentEntries.push({
        fullUrl: `urn:uuid:${appointmentId}`,
        resource: {
          resourceType: 'Appointment',
          id: appointmentId,
          meta: {
            profile: ['http://hl7.org/fhir/StructureDefinition/Appointment'],
          },
          status: mapAppointmentStatusToFhir(item.status),
          serviceType: [{ text: serviceName }],
          start: startIso,
          participant: [
            {
              actor: { reference: `Patient/${patientRef}`, display: patientName },
              status: 'accepted',
            },
            {
              actor: { reference: `Practitioner/${practitionerRef}`, display: doctorName },
              status: 'accepted',
            },
          ],
          basedOn: [{ reference: `Encounter/${encounterId}` }],
          extension: [
            {
              url: 'https://clinic.local/fhir/StructureDefinition/appointment-fee-vnd',
              valueInteger: Number(item.fee || 0),
            },
          ],
        },
      });
    });

    const entries = [
      ...patientEntries,
      ...practitionerEntries,
      ...encounterEntries,
      ...appointmentEntries,
    ];

    return {
      resourceType: 'Bundle',
      id: `clinic-report-${new Date().toISOString().slice(0, 10)}`,
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries,
      meta: {
        tag: [{
          system: 'https://clinic.local/fhir/tags',
          code: 'analytics-export',
          display: 'Analytics Export Package',
        }],
      },
    };
  }, [filteredAppointments]);

  const complianceAuditTrail = useMemo(() => {
    const nowLabel = formatDateByOptions(new Date(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const rows = complianceChecks.map((item) => ({
      timestamp: nowLabel,
      domain: item.framework,
      owner: item.owner,
      score: item.score,
      level: item.level,
      control: item.controlFocus,
      evidence: item.evidence,
      integrityHash: packageIntegrityHash ? `${packageIntegrityHash.slice(0, 18)}...` : 'pending',
    }));

    if (packageSignature) {
      rows.push({
        timestamp: nowLabel,
        domain: 'Package Signature',
        owner: 'Security Operations',
        score: 'N/A',
        level: 'Signed',
        control: 'ECDSA P-256 digital signature',
        evidence: 'Executive package signed and ready for external sharing verification.',
        integrityHash: packageIntegrityHash ? `${packageIntegrityHash.slice(0, 18)}...` : 'pending',
      });
    }

    return rows;
  }, [complianceChecks, packageIntegrityHash, packageSignature]);

  const complianceAuditChain = useMemo(() => {
    let previousHash = 'GENESIS';
    return complianceAuditTrail.map((row, index) => {
      const entryHash = buildAuditChainEntryHash(index + 1, previousHash, row);
      const chainRow = {
        chainIndex: index + 1,
        previousHash,
        entryHash,
        ...row,
      };
      previousHash = entryHash;
      return chainRow;
    });
  }, [complianceAuditTrail]);

  const complianceChainRootHash = complianceAuditChain[complianceAuditChain.length - 1]?.entryHash || 'GENESIS';

  const handleRotateSigningKey = useCallback(async () => {
    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');

      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const keyId = `key-${Date.now()}`;
      signingPrivateKeysRef.current.set(keyId, keyPair.privateKey);

      const keyMeta = {
        id: keyId,
        createdAt: new Date().toISOString(),
        algorithm: 'ECDSA-P256-SHA256',
        publicKey: publicKeyJwk,
      };

      setSigningKeyRing((prev) => [keyMeta, ...prev].slice(0, 8));
      setActiveSigningKeyId(keyId);
      setSignatureStatus(`Signing key rotated. Active key: ${keyId}.`);
      return keyMeta;
    } catch {
      setSignatureStatus('Unable to rotate key in this environment.');
      return null;
    }
  }, []);

  const resolveActiveSigningKey = useCallback(async () => {
    const existing = signingKeyRing.find((key) => key.id === activeSigningKeyId);
    const privateKey = activeSigningKeyId ? signingPrivateKeysRef.current.get(activeSigningKeyId) : null;
    if (existing && privateKey) {
      return { keyMeta: existing, privateKey };
    }

    const rotated = await handleRotateSigningKey();
    if (!rotated) return null;
    return {
      keyMeta: rotated,
      privateKey: signingPrivateKeysRef.current.get(rotated.id),
    };
  }, [activeSigningKeyId, signingKeyRing, handleRotateSigningKey]);

  const handleExportBoard = useCallback(() => {
    const bestScenario = [...scenarioComparisons].sort((a, b) => b.score - a.score)[0];
    const rows = [
      { section: 'Executive', metric: 'Risk Index', value: executiveSnapshot.riskIndex },
      { section: 'Executive', metric: 'Growth Opportunity Index', value: executiveSnapshot.growthIndex },
      { section: 'Executive', metric: 'Execution Readiness', value: executiveSnapshot.executionIndex },
      { section: 'Executive', metric: 'Decision', value: executiveSnapshot.decision },
      { section: 'Executive', metric: 'Top Focus', value: executiveSnapshot.topFocus },
      { section: 'Quality', metric: 'Data Trust Score', value: dataQuality.score },
      { section: 'Quality', metric: 'Data Grade', value: dataQuality.grade },
      { section: 'Compliance', metric: 'HIPAA Score', value: complianceChecks.find((item) => item.id === 'hipaa')?.score ?? 'N/A' },
      { section: 'Compliance', metric: 'GDPR Score', value: complianceChecks.find((item) => item.id === 'gdpr')?.score ?? 'N/A' },
      { section: 'Compliance', metric: 'ISO 27001 Score', value: complianceChecks.find((item) => item.id === 'iso')?.score ?? 'N/A' },
      { section: 'Interoperability', metric: 'FHIR Bundle Resources', value: fhirBundle.total },
      { section: 'Scenario', metric: 'Best Scenario', value: bestScenario?.name || 'N/A' },
      { section: 'Scenario', metric: 'Best Scenario Score', value: bestScenario?.score ?? 'N/A' },
    ];

    scenarioComparisons.forEach((item) => {
      rows.push({ section: item.name, metric: 'Projected Appointments', value: item.projectedAppointments });
      rows.push({ section: item.name, metric: 'Projected Revenue', value: item.projectedRevenue });
      rows.push({ section: item.name, metric: 'Projected Completion', value: `${item.projectedCompletion}%` });
      rows.push({ section: item.name, metric: 'Projected Risk', value: item.projectedRisk });
      rows.push({ section: item.name, metric: 'Scenario Score', value: item.score });
    });

    aiBriefing.forEach((line, idx) => {
      rows.push({ section: 'AI Briefing', metric: `Line ${idx + 1}`, value: line });
    });

    weeklyBriefingTemplate.keyWins.forEach((line, idx) => {
      rows.push({ section: 'Weekly Briefing - Wins', metric: `Win ${idx + 1}`, value: line });
    });
    weeklyBriefingTemplate.keyRisks.forEach((line, idx) => {
      rows.push({ section: 'Weekly Briefing - Risks', metric: `Risk ${idx + 1}`, value: line });
    });
    weeklyBriefingTemplate.nextActions.forEach((line, idx) => {
      rows.push({ section: 'Weekly Briefing - Actions', metric: `Action ${idx + 1}`, value: line });
    });

    scenarioHistory.slice(0, 5).forEach((item, idx) => {
      rows.push({ section: 'Scenario Delta Tracker', metric: `Run ${idx + 1}`, value: `${item.name} | score ${item.score} | ${item.timestamp}` });
    });

    exportToCSV(rows, `executive_board_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [scenarioComparisons, executiveSnapshot, dataQuality.score, dataQuality.grade, complianceChecks, fhirBundle.total, aiBriefing, weeklyBriefingTemplate, scenarioHistory]);

  const handleExportWeeklyPack = useCallback(() => {
    const rows = [
      { section: 'Weekly Template', metric: 'Period', value: weeklyBriefingTemplate.period },
      { section: 'Weekly Template', metric: 'Risk Index', value: executiveSnapshot.riskIndex },
      { section: 'Weekly Template', metric: 'Execution Readiness', value: executiveSnapshot.executionIndex },
      { section: 'Weekly Template', metric: 'Data Trust', value: `${dataQuality.score}/100` },
      { section: 'Weekly Template', metric: 'Anomaly Signals', value: anomalySignals.length },
    ];

    weeklyBriefingTemplate.keyWins.forEach((line, idx) => {
      rows.push({ section: 'Key Wins', metric: `Win ${idx + 1}`, value: line });
    });
    weeklyBriefingTemplate.keyRisks.forEach((line, idx) => {
      rows.push({ section: 'Key Risks', metric: `Risk ${idx + 1}`, value: line });
    });
    weeklyBriefingTemplate.nextActions.forEach((line, idx) => {
      rows.push({ section: 'Next Actions', metric: `Action ${idx + 1}`, value: line });
    });

    scenarioDriftAlerts.forEach((alert, idx) => {
      rows.push({
        section: 'Scenario Drift Alert',
        metric: `Alert ${idx + 1}`,
        value: `${alert.scenario}: score ${alert.scoreDelta >= 0 ? '+' : ''}${alert.scoreDelta}, revenue ${alert.revenueDelta >= 0 ? '+' : ''}${formatNumber(alert.revenueDelta)} đ`,
      });
    });

    scenarioHistory.slice(0, 8).forEach((item, idx) => {
      rows.push({ section: 'Scenario History', metric: `Run ${idx + 1}`, value: `${item.name} | score ${item.score} | ${item.timestamp}` });
    });

    exportToCSV(rows, `weekly_briefing_pack_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [weeklyBriefingTemplate, executiveSnapshot.riskIndex, executiveSnapshot.executionIndex, dataQuality.score, anomalySignals.length, scenarioDriftAlerts, scenarioHistory]);

  const handleAutoMondayBriefing = useCallback(() => {
    const range = getPreviousWeekRange();
    setDateRange(range);
    setStatusFilter('');
    setServiceFilter('');
    setDoctorFilter('');
    setSelectedPresetId('');
    handleExportWeeklyPack();
  }, [handleExportWeeklyPack]);

  const handleResetIntelligence = useCallback(() => {
    clearFilters();
    setAlertRules({ minCompletionRate: 80, maxCancellationRate: 25, minRetentionRate: 35 });
    setSimulator({ extraAppointments: 10, avgFee: 220000, completionLift: 5 });
    setDigitalTwin({ doctorHours: 160, noShowRate: 12, aiAutomation: 25, telehealthMix: 20 });
    setScenarioHistory([]);
    setBriefCopyStatus('Intelligence state reset to baseline.');
  }, []);

  const handleCopyAutoBrief = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(autoBriefText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = autoBriefText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setBriefCopyStatus('Auto-brief copied for email/Slack.');
    } catch {
      setBriefCopyStatus('Unable to copy auto-brief.');
    }
  }, [autoBriefText]);

  const handleGenerateEmailHtml = useCallback(() => {
    const safeLines = aiBriefing.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    const safeWins = weeklyBriefingTemplate.keyWins.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    const safeRisks = weeklyBriefingTemplate.keyRisks.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    const safeActions = weeklyBriefingTemplate.nextActions.map((line) => `<li>${escapeHtml(line)}</li>`).join('');

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Executive Weekly Brief</title>
    <style>
      body { margin: 0; padding: 20px; background: #f3f7fb; font-family: 'Segoe UI', Tahoma, sans-serif; color: #12324f; }
      .card { max-width: 780px; margin: 0 auto; background: #fff; border: 1px solid #d7e5f5; border-radius: 14px; box-shadow: 0 8px 24px rgba(7, 44, 77, 0.08); overflow: hidden; }
      .hero { padding: 18px 20px; background: linear-gradient(120deg, #0f5d9f, #1782b8); color: #fff; }
      .hero h1 { margin: 0; font-size: 21px; }
      .hero p { margin: 6px 0 0; opacity: 0.95; }
      .body { padding: 18px 20px 22px; }
      .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
      .meta div { border: 1px solid #dce8f7; border-radius: 10px; background: #f8fbff; padding: 10px; }
      .meta b { display: block; font-size: 21px; color: #0c4f82; }
      h2 { margin: 16px 0 8px; font-size: 16px; color: #0b4c7d; }
      ul, ol { margin: 0; padding-left: 18px; }
      li { margin-bottom: 7px; line-height: 1.42; }
      .footer { margin-top: 16px; font-size: 12px; color: #55718a; border-top: 1px dashed #d6e4f4; padding-top: 10px; }
      @media (max-width: 700px) {
        body { padding: 10px; }
        .meta { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <article class="card">
      <header class="hero">
        <h1>Clinic Executive Weekly Brief</h1>
        <p>${escapeHtml(weeklyBriefingTemplate.period)}</p>
      </header>
      <section class="body">
        <div class="meta">
          <div><span>Risk Index</span><b>${executiveSnapshot.riskIndex}</b></div>
          <div><span>Execution</span><b>${executiveSnapshot.executionIndex}</b></div>
          <div><span>Data Trust</span><b>${dataQuality.score}/100</b></div>
        </div>

        <h2>Executive 5-Line</h2>
        <ol>${safeLines}</ol>

        <h2>Key Wins</h2>
        <ul>${safeWins}</ul>

        <h2>Key Risks</h2>
        <ul>${safeRisks}</ul>

        <h2>Next Actions</h2>
        <ul>${safeActions}</ul>

        <p class="footer">Generated from Reports Command Center on ${formatDateByOptions(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}.</p>
      </section>
    </article>
  </body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `executive_brief_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setEmailTemplateStatus('Executive email HTML generated and downloaded.');
  }, [aiBriefing, weeklyBriefingTemplate, executiveSnapshot.riskIndex, executiveSnapshot.executionIndex, dataQuality.score]);

  const handleSendBriefEmail = useCallback((profileOverride) => {
    const profileId = profileOverride || selectedEmailProfile;
    const profile = EMAIL_RECIPIENT_PROFILES[profileId] || EMAIL_RECIPIENT_PROFILES.leadership;
    const toLine = customEmailTo.trim() || profile.to.join(',');
    const ccLine = customEmailCc.trim() || profile.cc.join(',');
    const subject = encodeURIComponent(`Clinic Executive Brief - ${weeklyBriefingTemplate.period}`);
    const body = encodeURIComponent(`${autoBriefText}\n\nGenerated from Reports Command Center.`);
    const ccPart = ccLine ? `&cc=${encodeURIComponent(ccLine)}` : '';
    window.location.href = `mailto:${encodeURIComponent(toLine)}?subject=${subject}${ccPart}&body=${body}`;
    setEmailTemplateStatus(`Opened mail client for ${profile.label}.`);
  }, [selectedEmailProfile, customEmailTo, customEmailCc, weeklyBriefingTemplate.period, autoBriefText]);

  const handleResetEmailRecipients = useCallback(() => {
    setSelectedEmailProfile('leadership');
    setCustomEmailTo('');
    setCustomEmailCc('');
    localStorage.removeItem(REPORTS_EMAIL_RECIPIENTS_KEY);
    setEmailTemplateStatus('Recipient settings reset to default Leadership profile.');
  }, []);

  const handleRunRecoveryPlan = useCallback(() => {
    applyQuickRange(60);
    setStatusFilter('pending');
    setAlertRules({ minCompletionRate: 84, maxCancellationRate: 20, minRetentionRate: 42 });
    setSimulator({ extraAppointments: 16, avgFee: 215000, completionLift: 11 });
    setDigitalTwin((prev) => ({ ...prev, doctorHours: Math.max(168, Number(prev.doctorHours || 0)), aiAutomation: 36, telehealthMix: 34, noShowRate: 9 }));
    setScenarioHistory((prev) => [
      {
        id: `${Date.now()}-recovery-plan`,
        scenarioId: 'recovery-plan',
        name: 'Recovery Plan Activation',
        score: Math.round(clamp((100 - executiveSnapshot.riskIndex) * 0.45 + executiveSnapshot.executionIndex * 0.55, 0, 100)),
        projectedRevenue: whatIfProjection.projectedRevenue,
        projectedCompletion: whatIfProjection.projectedCompletion,
        timestamp: formatDateByOptions(new Date(), {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...prev,
    ].slice(0, 12));
    setRecoveryStatus('One-click recovery plan activated: filters, thresholds, and simulation baselines are now in recovery mode.');
  }, [executiveSnapshot.riskIndex, executiveSnapshot.executionIndex, whatIfProjection.projectedRevenue, whatIfProjection.projectedCompletion]);

  const handleExportFhirBundle = useCallback(() => {
    const payload = JSON.stringify(fhirBundle, null, 2);
    const blob = new Blob([payload], { type: 'application/fhir+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `clinic_fhir_r4_bundle_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setFhirExportStatus(`FHIR R4 bundle exported with ${fhirBundle.total} appointment resources.`);
  }, [fhirBundle]);

  const handleExportFhirEventLog = useCallback(() => {
    const ndjson = fhirSubscriptionFeed
      .map((event) => JSON.stringify({
        timestamp: event.eventTime,
        topic: event.topic,
        eventType: event.eventType,
        resourceRef: event.payloadRef,
        patient: event.patient,
        doctor: event.doctor,
        service: event.service,
        severity: event.severity,
      }))
      .join('\n');

    const blob = new Blob([ndjson], { type: 'application/x-ndjson;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fhir_subscription_events_${new Date().toISOString().slice(0, 10)}.ndjson`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setFhirExportStatus(`FHIR subscription event log exported (${fhirSubscriptionFeed.length} events).`);
  }, [fhirSubscriptionFeed]);

  const handleExportOutreachPlan = useCallback(() => {
    const rows = outreachQueue.map((item) => ({
      queue: item.segment,
      patients: item.patients,
      severity: item.severity,
      etaHours: item.etaHours,
      intervention: item.intervention,
    }));
    exportToCSV(rows, `population_outreach_plan_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [outreachQueue]);

  const handleApplyDtxPolicy = useCallback(() => {
    try {
      const parsed = JSON.parse(dtxPolicyDraft);
      const validated = validateDtxPolicyPayload(parsed);
      setDtxPolicy(validated);
      setDtxPolicyApproval((prev) => ({
        ...prev,
        status: 'draft',
        approvedAt: '',
        note: 'Policy changed and moved to Draft state.',
      }));
      setDtxPolicyVerifyReport(null);
      setDtxPolicyVerifyStatus('');
      appendGovernanceAudit('DTX_POLICY_APPLIED', 'Policy JSON applied and marked Draft.');
      setDtxPolicyStatus('DTx policy updated successfully.');
    } catch (error) {
      setDtxPolicyStatus(`DTx policy invalid: ${error.message}`);
    }
  }, [dtxPolicyDraft, appendGovernanceAudit]);

  const handlePublishDtxPolicyVersion = useCallback(() => {
    try {
      const parsed = JSON.parse(dtxPolicyDraft);
      const validated = validateDtxPolicyPayload(parsed);
      const version = {
        id: `dtx-policy-${Date.now()}`,
        label: `Policy ${formatDateByOptions(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        createdAt: new Date().toISOString(),
        policy: validated,
      };

      setDtxPolicy(validated);
      setDtxPolicyHistory((prev) => [version, ...prev].slice(0, 12));
      setSelectedDtxPolicyVersionId(version.id);
      setDtxPolicyApproval((prev) => ({
        ...prev,
        status: 'reviewed',
        reviewedAt: new Date().toISOString(),
        note: `Published ${version.label}. Awaiting approval.`,
      }));
      appendGovernanceAudit('DTX_POLICY_PUBLISHED', `Published ${version.label}.`);
      setDtxPolicyStatus(`DTx policy published: ${version.label}.`);
    } catch (error) {
      setDtxPolicyStatus(`DTx policy publish failed: ${error.message}`);
    }
  }, [dtxPolicyDraft, appendGovernanceAudit]);

  const handleLoadDtxPolicyVersion = useCallback((versionId) => {
    setSelectedDtxPolicyVersionId(versionId);
    const version = dtxPolicyHistory.find((item) => item.id === versionId);
    if (!version?.policy) return;
    setDtxPolicy(version.policy);
    setDtxPolicyDraft(JSON.stringify(version.policy, null, 2));
    setDtxPolicyApproval((prev) => ({
      ...prev,
      status: 'reviewed',
      reviewedAt: new Date().toISOString(),
      approvedAt: '',
      note: `Loaded policy version ${version.label} for review.`,
    }));
    appendGovernanceAudit('DTX_POLICY_VERSION_LOADED', `Loaded ${version.label} for review.`);
    setDtxPolicyStatus(`Loaded DTx policy version: ${version.label}.`);
  }, [dtxPolicyHistory, appendGovernanceAudit]);

  const handleExportDtxPolicy = useCallback(() => {
    const payload = JSON.stringify(dtxPolicy, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dtx_policy_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setDtxPolicyStatus('DTx policy JSON exported successfully.');
  }, [dtxPolicy]);

  const handleImportDtxPolicy = useCallback(() => {
    dtxPolicyFileInputRef.current?.click();
  }, []);

  const handleDtxPolicyFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = validateDtxPolicyPayload(parsed);
      setDtxPolicy(validated);
      setDtxPolicyDraft(JSON.stringify(validated, null, 2));
      setDtxPolicyApproval((prev) => ({
        ...prev,
        status: 'reviewed',
        reviewedAt: new Date().toISOString(),
        approvedAt: '',
        note: `Imported policy file ${file.name}.`,
      }));
      setDtxPolicyVerifyReport(null);
      setDtxPolicyVerifyStatus('');
      appendGovernanceAudit('DTX_POLICY_IMPORTED', `Imported policy file ${file.name}.`);
      setDtxPolicyStatus(`DTx policy imported from ${file.name}.`);
    } catch (error) {
      setDtxPolicyStatus(`DTx policy import failed: ${error.message}`);
    }
  }, [appendGovernanceAudit]);

  const handleResetDtxPolicyDefault = useCallback(() => {
    setDtxPolicy(DEFAULT_DTX_POLICY);
    setDtxPolicyDraft(JSON.stringify(DEFAULT_DTX_POLICY, null, 2));
    setSelectedDtxPolicyVersionId('');
    setDtxPolicyApproval({
      status: 'draft',
      reviewedAt: '',
      approvedAt: '',
      note: 'Reset to default baseline policy.',
    });
    setDtxPolicyVerifyReport(null);
    setDtxPolicyVerifyStatus('');
    appendGovernanceAudit('DTX_POLICY_RESET_DEFAULT', 'Policy reset to default baseline.');
    setDtxPolicyStatus('DTx policy reset to default baseline.');
  }, [appendGovernanceAudit]);

  const handleMarkDtxPolicyReviewed = useCallback(() => {
    setDtxPolicyApproval((prev) => ({
      ...prev,
      status: 'reviewed',
      reviewedAt: new Date().toISOString(),
      approvedAt: '',
      note: 'Policy reviewed by governance reviewer.',
    }));
    appendGovernanceAudit('DTX_POLICY_REVIEWED', 'Policy marked as Reviewed.');
  }, [appendGovernanceAudit]);

  const handleMarkDtxPolicyApproved = useCallback(() => {
    if (dtxPolicyVerifyReport?.result !== 'valid') {
      setDtxPolicyStatus('Approval blocked: verify signed bundle successfully before approving.');
      appendGovernanceAudit('DTX_POLICY_APPROVAL_BLOCKED', 'Attempted approval without valid verification report.');
      return;
    }

    setDtxPolicyApproval((prev) => ({
      ...prev,
      status: 'approved',
      reviewedAt: prev.reviewedAt || new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      note: 'Policy approved for production use.',
    }));
    appendGovernanceAudit('DTX_POLICY_APPROVED', 'Policy marked as Approved after successful verification.');
  }, [dtxPolicyVerifyReport, appendGovernanceAudit]);

  const handleExportSignedDtxPolicyBundle = useCallback(async () => {
    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
      const signingContext = await resolveActiveSigningKey();
      if (!signingContext?.privateKey || !signingContext?.keyMeta) throw new Error('No signing key');

      const payload = {
        generatedAt: new Date().toISOString(),
        activePolicy: dtxPolicy,
        activePolicyVersionId: selectedDtxPolicyVersionId || 'manual',
        totalVersions: dtxPolicyHistory.length,
      };

      const payloadString = JSON.stringify(payload);
      const payloadBuffer = new TextEncoder().encode(payloadString);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', payloadBuffer);
      const hashHex = toHex(new Uint8Array(hashBuffer));

      const signature = await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        signingContext.privateKey,
        payloadBuffer
      );

      const bundle = {
        algorithm: 'ECDSA-P256-SHA256',
        keyId: signingContext.keyMeta.id,
        publicKey: signingContext.keyMeta.publicKey,
        payloadHash: hashHex,
        signature: toBase64(new Uint8Array(signature)),
        payload,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dtx_policy_signed_bundle_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setDtxPolicyBundleStatus(`Signed DTx bundle exported with key ${signingContext.keyMeta.id}.`);
      appendGovernanceAudit('DTX_SIGNED_BUNDLE_EXPORTED', `Signed bundle exported with key ${signingContext.keyMeta.id}.`);
    } catch (error) {
      setDtxPolicyBundleStatus(`Unable to export signed DTx bundle: ${error.message}`);
      appendGovernanceAudit('DTX_SIGNED_BUNDLE_EXPORT_FAILED', error.message || 'Unknown export failure.');
    }
  }, [resolveActiveSigningKey, dtxPolicy, selectedDtxPolicyVersionId, dtxPolicyHistory.length, appendGovernanceAudit]);

  const handleVerifySignedDtxPolicyBundle = useCallback(() => {
    dtxSignedBundleFileInputRef.current?.click();
  }, []);

  const handleDtxSignedBundleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
      const text = await file.text();
      const bundle = JSON.parse(text);

      if (!bundle?.publicKey || !bundle?.signature || !bundle?.payload || !bundle?.payloadHash) {
        throw new Error('Invalid bundle structure');
      }

      const payloadString = JSON.stringify(bundle.payload);
      const payloadBuffer = new TextEncoder().encode(payloadString);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', payloadBuffer);
      const hashHex = toHex(new Uint8Array(hashBuffer));
      const hashValid = hashHex.toLowerCase() === String(bundle.payloadHash).toLowerCase();

      const importedPublicKey = await window.crypto.subtle.importKey(
        'jwk',
        bundle.publicKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );

      const signatureValid = await window.crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        importedPublicKey,
        fromBase64(String(bundle.signature)),
        payloadBuffer
      );

      if (!hashValid || !signatureValid) {
        throw new Error(`Verification failed (hash=${hashValid}, signature=${signatureValid})`);
      }

      setDtxPolicyVerifyReport({
        keyId: bundle.keyId || 'unknown',
        algorithm: bundle.algorithm || 'ECDSA-P256-SHA256',
        verifiedAt: new Date().toISOString(),
        hashValid,
        signatureValid,
        payloadHash: hashHex,
        result: 'valid',
      });
      setDtxPolicyVerifyStatus(`Signed bundle verified: key ${bundle.keyId || 'unknown'} is valid.`);
      appendGovernanceAudit('DTX_SIGNED_BUNDLE_VERIFIED', `Bundle verified with key ${bundle.keyId || 'unknown'}.`);
    } catch (error) {
      setDtxPolicyVerifyReport({
        keyId: 'unknown',
        algorithm: 'unknown',
        verifiedAt: new Date().toISOString(),
        hashValid: false,
        signatureValid: false,
        payloadHash: 'N/A',
        result: 'invalid',
      });
      setDtxPolicyVerifyStatus(`Signed bundle verification failed: ${error.message}`);
      appendGovernanceAudit('DTX_SIGNED_BUNDLE_VERIFY_FAILED', error.message || 'Unknown verify failure.');
    }
  }, [appendGovernanceAudit]);

  const handlePreviewOutreachRebalance = useCallback(() => {
    const hasDelta =
      Number(outreachRebalanceCandidate.addCareManagers || 0) > 0 ||
      Number(outreachRebalanceCandidate.addNurses || 0) > 0 ||
      Number(outreachRebalanceCandidate.addUrgentSlots || 0) > 0;
    if (!hasDelta) {
      setOutreachRebalancePreview(null);
      appendGovernanceAudit('OUTREACH_REBALANCE_PREVIEW_SKIPPED', 'No delta suggested by SLA planner.');
      return;
    }

    setOutreachRebalancePreview({
      before: { ...outreachCapacity },
      after: { ...outreachRebalanceCandidate.nextCapacity },
      delta: {
        careManagers: outreachRebalanceCandidate.addCareManagers,
        nurses: outreachRebalanceCandidate.addNurses,
        urgentSlotsPerDay: outreachRebalanceCandidate.addUrgentSlots,
      },
    });
    appendGovernanceAudit('OUTREACH_REBALANCE_PREVIEWED', `Preview +CM ${outreachRebalanceCandidate.addCareManagers}, +N ${outreachRebalanceCandidate.addNurses}, +Urgent ${outreachRebalanceCandidate.addUrgentSlots}.`);
  }, [outreachRebalanceCandidate, outreachCapacity, appendGovernanceAudit]);

  const handleApplyOutreachRebalance = useCallback(() => {
    const preview = outreachRebalancePreview || {
      before: { ...outreachCapacity },
      after: { ...outreachRebalanceCandidate.nextCapacity },
    };

    const changed =
      Number(preview.before.careManagers || 0) !== Number(preview.after.careManagers || 0) ||
      Number(preview.before.nurses || 0) !== Number(preview.after.nurses || 0) ||
      Number(preview.before.urgentSlotsPerDay || 0) !== Number(preview.after.urgentSlotsPerDay || 0);

    if (!changed) {
      appendGovernanceAudit('OUTREACH_REBALANCE_APPLY_SKIPPED', 'Apply skipped due to no effective change.');
      return;
    }
    setOutreachRebalanceRollbackSnapshot(preview.before);
    setOutreachCapacity(preview.after);
    setOutreachRebalancePreview(null);
    appendGovernanceAudit('OUTREACH_REBALANCE_APPLIED', `Applied rebalance to CM ${preview.after.careManagers}, N ${preview.after.nurses}, urgent ${preview.after.urgentSlotsPerDay}.`);
  }, [outreachRebalancePreview, outreachCapacity, outreachRebalanceCandidate.nextCapacity, appendGovernanceAudit]);

  const handleRollbackOutreachRebalance = useCallback(() => {
    if (!outreachRebalanceRollbackSnapshot) {
      appendGovernanceAudit('OUTREACH_REBALANCE_ROLLBACK_SKIPPED', 'No rollback snapshot available.');
      return;
    }
    setOutreachCapacity(outreachRebalanceRollbackSnapshot);
    setOutreachRebalanceRollbackSnapshot(null);
    setOutreachRebalancePreview(null);
    appendGovernanceAudit('OUTREACH_REBALANCE_ROLLED_BACK', 'Rollback restored previous outreach capacity settings.');
  }, [outreachRebalanceRollbackSnapshot, appendGovernanceAudit]);

  const handleToggleFeedReplay = useCallback(() => {
    setFeedReplayActive((prev) => !prev);
    setFeedReplayCursor(1);
  }, []);

  const handleResetFeedReplay = useCallback(() => {
    setFeedReplayActive(false);
    setFeedReplayCursor(0);
  }, []);

  useEffect(() => {
    if (!feedReplayActive || !replayFeedEvents.length) return;
    const maxCursor = fhirSubscriptionFeed.length;
    const timer = window.setInterval(() => {
      setFeedReplayCursor((prev) => {
        if (prev >= maxCursor) return 1;
        return prev + 1;
      });
    }, Math.max(300, Number(feedReplayIntervalMs) || 1200));

    return () => window.clearInterval(timer);
  }, [feedReplayActive, replayFeedEvents.length, feedReplayIntervalMs, fhirSubscriptionFeed.length]);

  const handleExportComplianceAudit = useCallback(() => {
    exportToCSV(complianceAuditChain, `compliance_audit_chain_${new Date().toISOString().slice(0, 10)}.csv`);
    setComplianceStatus(`Compliance audit chain exported (${complianceAuditChain.length} linked entries).`);
  }, [complianceAuditChain]);

  const handleGenerateIntegrityHash = useCallback(async () => {
    const digestPayload = JSON.stringify({
      generatedAt: new Date().toISOString(),
      period: weeklyBriefingTemplate.period,
      aiBriefing,
      compliance: complianceChecks.map((item) => ({ framework: item.framework, score: item.score, level: item.level })),
      riskIndex: executiveSnapshot.riskIndex,
      executionIndex: executiveSnapshot.executionIndex,
      scenarioTop: scenarioComparisons.slice(0, 3),
      fhirTotalResources: fhirBundle.total,
    });

    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
      const buffer = new TextEncoder().encode(digestPayload);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setPackageIntegrityHash(hashHex);
      setComplianceStatus('SHA-256 integrity hash generated for board package verification.');
    } catch {
      const fallbackHash = `fallback-${Date.now()}-${hashString(digestPayload)}`;
      setPackageIntegrityHash(fallbackHash);
      setComplianceStatus('Web Crypto unavailable, generated fallback package fingerprint.');
    }
  }, [weeklyBriefingTemplate.period, aiBriefing, complianceChecks, executiveSnapshot.riskIndex, executiveSnapshot.executionIndex, scenarioComparisons, fhirBundle.total]);

  const handleSignExecutivePackage = useCallback(async () => {
    const packagePayload = JSON.stringify({
      generatedAt: new Date().toISOString(),
      period: weeklyBriefingTemplate.period,
      riskIndex: executiveSnapshot.riskIndex,
      executionIndex: executiveSnapshot.executionIndex,
      compliance: complianceChecks,
      integrityHash: packageIntegrityHash,
      fhirSummary: {
        totalResources: fhirBundle.total,
      },
    });

    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
      const signingContext = await resolveActiveSigningKey();
      if (!signingContext?.privateKey || !signingContext?.keyMeta) throw new Error('No signing key');

      const payloadBuffer = new TextEncoder().encode(packagePayload);
      const signature = await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        signingContext.privateKey,
        payloadBuffer
      );

      const signatureBase64 = toBase64(new Uint8Array(signature));
      const signedPayload = {
        keyId: signingContext.keyMeta.id,
        algorithm: 'ECDSA-P256-SHA256',
        signature: signatureBase64,
        publicKey: signingContext.keyMeta.publicKey,
        payload: JSON.parse(packagePayload),
        signedAt: new Date().toISOString(),
      };

      setSignedPackageEnvelope(signedPayload);
      setPackageSignature(JSON.stringify(signedPayload, null, 2));
      setSignatureStatus(`Executive package digitally signed with key ${signingContext.keyMeta.id}.`);
      setSignatureVerifyStatus('');
      setSignatureVerificationDetails(null);
      setManifestImportReport(null);
    } catch {
      const fallback = {
        keyId: `fallback-${Date.now()}`,
        algorithm: 'fallback-fingerprint',
        signature: `fallback-${Date.now()}-${hashString(packagePayload)}`,
        payload: JSON.parse(packagePayload),
        signedAt: new Date().toISOString(),
      };
      setSignedPackageEnvelope(fallback);
      setPackageSignature(JSON.stringify(fallback, null, 2));
      setSignatureStatus('Web Crypto unavailable, generated fallback signature fingerprint.');
      setSignatureVerifyStatus('');
      setSignatureVerificationDetails(null);
      setManifestImportReport(null);
    }
  }, [weeklyBriefingTemplate.period, executiveSnapshot.riskIndex, executiveSnapshot.executionIndex, complianceChecks, packageIntegrityHash, fhirBundle.total, resolveActiveSigningKey]);

  const handleVerifyExecutiveSignature = useCallback(async () => {
    if (!signedPackageEnvelope?.signature || !signedPackageEnvelope?.payload || !signedPackageEnvelope?.publicKey) {
      setSignatureVerifyStatus('No verifiable signature payload found. Sign package first.');
      return;
    }

    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
      const publicKey = await window.crypto.subtle.importKey(
        'jwk',
        signedPackageEnvelope.publicKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      const payloadBytes = new TextEncoder().encode(JSON.stringify(signedPackageEnvelope.payload));
      const signatureBytes = fromBase64(signedPackageEnvelope.signature);
      const payloadDigestBuffer = await window.crypto.subtle.digest('SHA-256', payloadBytes);
      const payloadHash = toHex(new Uint8Array(payloadDigestBuffer));

      const isValid = await window.crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        signatureBytes,
        payloadBytes
      );

      if (isValid) {
        setSignatureVerifyStatus('Signature verified successfully. Package integrity is valid.');
      } else {
        setSignatureVerifyStatus('Signature verification failed. Package may be altered.');
      }

      setSignatureVerificationDetails({
        keyId: signedPackageEnvelope.keyId || 'N/A',
        algorithm: signedPackageEnvelope.algorithm || 'ECDSA-P256-SHA256',
        keyCurve: signedPackageEnvelope.publicKey?.crv || 'P-256',
        keyType: signedPackageEnvelope.publicKey?.kty || 'EC',
        signedAt: signedPackageEnvelope.signedAt || 'N/A',
        verifiedAt: new Date().toISOString(),
        signatureLength: signedPackageEnvelope.signature?.length || 0,
        payloadHash,
        chainRootHash: complianceChainRootHash,
        result: isValid ? 'valid' : 'invalid',
      });
    } catch {
      setSignatureVerifyStatus('Unable to verify signature on this environment.');
      setSignatureVerificationDetails({
        keyId: signedPackageEnvelope?.keyId || 'unknown',
        algorithm: signedPackageEnvelope?.algorithm || 'unknown',
        keyCurve: signedPackageEnvelope?.publicKey?.crv || 'unknown',
        keyType: signedPackageEnvelope?.publicKey?.kty || 'unknown',
        signedAt: signedPackageEnvelope?.signedAt || 'N/A',
        verifiedAt: new Date().toISOString(),
        signatureLength: signedPackageEnvelope?.signature?.length || 0,
        payloadHash: 'N/A',
        chainRootHash: complianceChainRootHash,
        result: 'unverified',
      });
    }
  }, [signedPackageEnvelope, complianceChainRootHash]);

  const handleExportSignedPackage = useCallback(() => {
    if (!signedPackageEnvelope) {
      setSignatureVerifyStatus('No signed package to export. Sign package first.');
      return;
    }

    const payload = JSON.stringify(signedPackageEnvelope, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `signed_executive_package_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setSignatureVerifyStatus('Signed package JSON exported for external verification.');
  }, [signedPackageEnvelope]);

  const handleSimulatePackageTamper = useCallback(() => {
    if (!signedPackageEnvelope?.payload) {
      setSignatureVerifyStatus('No signed package available for tamper simulation. Sign package first.');
      return;
    }

    const tampered = {
      ...signedPackageEnvelope,
      payload: {
        ...signedPackageEnvelope.payload,
        tamperedAt: new Date().toISOString(),
        riskIndex: Number(signedPackageEnvelope.payload?.riskIndex || 0) + 1,
      },
    };

    setSignedPackageEnvelope(tampered);
    setPackageSignature(JSON.stringify(tampered, null, 2));
    setSignatureVerifyStatus('Tamper simulation applied: payload changed while signature unchanged.');
    setSignatureVerificationDetails(null);
  }, [signedPackageEnvelope]);

  const handleExportAuditChainManifest = useCallback(() => {
    const manifest = {
      generatedAt: new Date().toISOString(),
      chainLength: complianceAuditChain.length,
      chainRootHash: complianceChainRootHash,
      activeKeyId: activeSigningKeyId || null,
      signingKeyRing,
      signatureEnvelope: signedPackageEnvelope ? {
        keyId: signedPackageEnvelope.keyId,
        algorithm: signedPackageEnvelope.algorithm,
        signedAt: signedPackageEnvelope.signedAt,
        publicKey: signedPackageEnvelope.publicKey || null,
      } : null,
      signedPackageEnvelope: signedPackageEnvelope || null,
      verificationDetails: signatureVerificationDetails,
      chain: complianceAuditChain,
    };

    const payload = JSON.stringify(manifest, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `compliance_chain_manifest_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setComplianceStatus('Compliance chain manifest exported for external audit verification.');
  }, [complianceAuditChain, complianceChainRootHash, signedPackageEnvelope, signatureVerificationDetails, signingKeyRing, activeSigningKeyId]);

  const handleImportAuditChainManifest = useCallback(() => {
    manifestFileInputRef.current?.click();
  }, []);

  const handleManifestFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload = await file.text();
      const manifest = JSON.parse(payload);
      const chain = Array.isArray(manifest?.chain) ? manifest.chain : [];
      if (!chain.length) throw new Error('Manifest has no chain entries');

      let previous = 'GENESIS';
      for (let i = 0; i < chain.length; i += 1) {
        const item = chain[i];
        const { chainIndex, previousHash, entryHash, ...row } = item;
        const normalizedIndex = Number(chainIndex || i + 1);
        if (previousHash !== previous) throw new Error(`Broken chain link at entry ${normalizedIndex}`);

        const expectedHash = buildAuditChainEntryHash(normalizedIndex, previousHash, row);
        if (entryHash !== expectedHash) throw new Error(`Invalid entry hash at entry ${normalizedIndex}`);
        previous = entryHash;
      }

      const rootMatch = (manifest.chainRootHash || 'GENESIS') === previous;
      if (!rootMatch) throw new Error('Manifest root hash does not match chain');

      let signatureResult = 'not-checked';
      const envelope = manifest.signedPackageEnvelope;
      if (envelope?.signature && envelope?.publicKey && envelope?.payload && window.crypto?.subtle) {
        try {
          const publicKey = await window.crypto.subtle.importKey(
            'jwk',
            envelope.publicKey,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
          );
          const payloadBytes = new TextEncoder().encode(JSON.stringify(envelope.payload));
          const signatureBytes = fromBase64(envelope.signature);
          const valid = await window.crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            publicKey,
            signatureBytes,
            payloadBytes
          );
          signatureResult = valid ? 'valid' : 'invalid';
        } catch {
          signatureResult = 'unable';
        }
      }

      setManifestImportReport({
        fileName: file.name,
        importedAt: new Date().toISOString(),
        chainLength: chain.length,
        chainRootHash: manifest.chainRootHash || 'GENESIS',
        activeKeyId: manifest.activeKeyId || envelope?.keyId || 'N/A',
        signatureResult,
      });
      setComplianceStatus(`Manifest imported and verified (${chain.length} entries). Signature: ${signatureResult}.`);
    } catch (error) {
      setManifestImportReport(null);
      setComplianceStatus(`Manifest import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }, []);

  const handlePrintExecutive = useCallback(() => {
    window.print();
  }, []);

  const runScenario = useCallback((scenarioId) => {
    const scenarioLabel = {
      growth: 'Growth Acceleration',
      retention: 'Retention Rescue',
      efficiency: 'Efficiency Maximizer',
    };
    const scenarioMeta = scenarioComparisons.find((item) => item.id === scenarioId);

    if (scenarioId === 'growth') {
      applyQuickRange(90);
      setStatusFilter('completed');
      setSimulator({ extraAppointments: 35, avgFee: 250000, completionLift: 8 });
      setDigitalTwin((prev) => ({ ...prev, aiAutomation: 40, telehealthMix: 30, noShowRate: 10 }));
    } else if (scenarioId === 'retention') {
      applyQuickRange(180);
      setStatusFilter('pending');
      setAlertRules((prev) => ({ ...prev, minRetentionRate: 45, minCompletionRate: 82 }));
      setSimulator({ extraAppointments: 18, avgFee: 210000, completionLift: 12 });
      setDigitalTwin((prev) => ({ ...prev, telehealthMix: 38, aiAutomation: 28 }));
    } else if (scenarioId === 'efficiency') {
      applyQuickRange(30);
      setServiceFilter('');
      setStatusFilter('completed');
      setAlertRules((prev) => ({ ...prev, maxCancellationRate: 18 }));
      setSimulator({ extraAppointments: 12, avgFee: 230000, completionLift: 10 });
      setDigitalTwin((prev) => ({ ...prev, doctorHours: 172, aiAutomation: 45, telehealthMix: 25 }));
    }

    setScenarioHistory((prev) => [
      {
        id: `${Date.now()}-${scenarioId}`,
        scenarioId,
        name: scenarioLabel[scenarioId] || scenarioId,
        score: scenarioMeta?.score ?? 0,
        projectedRevenue: scenarioMeta?.projectedRevenue ?? 0,
        projectedCompletion: scenarioMeta?.projectedCompletion ?? 0,
        timestamp: formatDateByOptions(new Date(), {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...prev,
    ].slice(0, 12));
  }, [scenarioComparisons]);

  const handleAskCopilot = async (event) => {
    event.preventDefault();
    if (!copilotQuestion.trim()) return;

    setCopilotLoading(true);
    try {
      const response = await askReportsAssistantAPI({
        question: copilotQuestion,
        filters: {
          from: dateRange.from,
          to: dateRange.to,
          status: statusFilter,
          service: serviceFilter,
        },
      });
      const data = response?.data || response;
      setCopilotAnswer(data?.answer || 'No response from copilot.');
      setCopilotHighlights(Array.isArray(data?.highlights) ? data.highlights : []);
    } catch (error) {
      setCopilotAnswer(error?.message || 'Failed to fetch copilot answer.');
      setCopilotHighlights([]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleExportCsv = useCallback(() => {
    exportAppointmentsCSV(filteredAppointments, 'clinic_report.csv');
  }, [filteredAppointments]);

  const applyQuickRange = (days) => {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));

    setDateRange({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  };

  const applyYearToDate = () => {
    const to = new Date();
    const from = new Date(to.getFullYear(), 0, 1);
    setDateRange({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  };

  const clearFilters = () => {
    setDateRange({ from: '', to: '' });
    setDoctorFilter('');
    setServiceFilter('');
    setStatusFilter('');
    setSelectedPresetId('');
  };

  const handleSavePreset = () => {
    const cleanName = presetName.trim();
    if (!cleanName) return;

    const preset = {
      id: `${Date.now()}`,
      name: cleanName,
      createdAt: new Date().toISOString(),
      filters: {
        dateRange,
        doctorFilter,
        serviceFilter,
        statusFilter,
      },
    };

    setSavedPresets((prev) => [preset, ...prev].slice(0, 8));
    setPresetName('');
    setSelectedPresetId(preset.id);
  };

  const handleApplyPreset = (presetId) => {
    setSelectedPresetId(presetId);
    const preset = savedPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setDateRange(preset.filters?.dateRange || { from: '', to: '' });
    setDoctorFilter(preset.filters?.doctorFilter || '');
    setServiceFilter(preset.filters?.serviceFilter || '');
    setStatusFilter(preset.filters?.statusFilter || '');
  };

  const handleDeletePreset = (presetId) => {
    setSavedPresets((prev) => prev.filter((item) => item.id !== presetId));
    if (selectedPresetId === presetId) setSelectedPresetId('');
  };

  useEffect(() => {
    const runReportsCommand = (action) => {
      if (!action) return;

      if (action === 'last30') {
        applyQuickRange(30);
        return;
      }
      if (action === 'last90') {
        applyQuickRange(90);
        return;
      }
      if (action === 'ytd') {
        applyYearToDate();
        return;
      }
      if (action === 'export') {
        handleExportCsv();
        return;
      }
      if (action === 'copilot') {
        copilotInputRef.current?.focus();
        copilotInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (action === 'simulator') {
        simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'alerts') {
        alertCenterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'quality') {
        qualityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'playbook') {
        playbookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'twin') {
        twinRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'scheduler') {
        schedulerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'trajectory') {
        trajectoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'precision') {
        precisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'rpm') {
        rpmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'pathway') {
        pathwayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'subscription') {
        subscriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx') {
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-apply-rules') {
        handleApplyDtxPolicy();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-export-policy') {
        handleExportDtxPolicy();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-import-policy') {
        handleImportDtxPolicy();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-reset-policy') {
        handleResetDtxPolicyDefault();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-sign-bundle') {
        handleExportSignedDtxPolicyBundle();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-verify-bundle') {
        handleVerifySignedDtxPolicyBundle();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-diff') {
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-governance-audit') {
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-mark-reviewed') {
        handleMarkDtxPolicyReviewed();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'dtx-mark-approved') {
        handleMarkDtxPolicyApproved();
        dtxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'population') {
        populationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'population-export-outreach') {
        handleExportOutreachPlan();
        populationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'population-sla') {
        populationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'population-rebalance') {
        handleApplyOutreachRebalance();
        populationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'population-rebalance-preview') {
        handlePreviewOutreachRebalance();
        populationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'population-rebalance-rollback') {
        handleRollbackOutreachRebalance();
        populationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'benchmark') {
        benchmarkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'compare') {
        comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'briefing') {
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'delta') {
        deltaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'weekly') {
        weeklyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'copy-brief') {
        handleCopyAutoBrief();
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'email-html') {
        handleGenerateEmailHtml();
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'mailto-brief') {
        handleSendBriefEmail();
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'mailto-brief-leadership') {
        handleSendBriefEmail('leadership');
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'mailto-brief-operations') {
        handleSendBriefEmail('operations');
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'mailto-brief-finance') {
        handleSendBriefEmail('finance');
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'compliance') {
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'fhir-export') {
        handleExportFhirBundle();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'fhir-event-export') {
        handleExportFhirEventLog();
        subscriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'fhir-replay-toggle') {
        handleToggleFeedReplay();
        subscriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'fhir-replay-reset') {
        handleResetFeedReplay();
        subscriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'integrity-hash') {
        handleGenerateIntegrityHash();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'compliance-audit-export') {
        handleExportComplianceAudit();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'package-sign') {
        handleSignExecutivePackage();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'package-verify') {
        handleVerifyExecutiveSignature();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'signed-package-export') {
        handleExportSignedPackage();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'package-tamper') {
        handleSimulatePackageTamper();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'audit-chain-manifest') {
        handleExportAuditChainManifest();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'audit-chain-import') {
        handleImportAuditChainManifest();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'package-key-rotate') {
        handleRotateSigningKey();
        complianceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'drift') {
        deltaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'recovery-plan') {
        handleRunRecoveryPlan();
        recoveryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'executive') {
        executiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'scenarios') {
        scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'scenario-growth') {
        runScenario('growth');
        scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'scenario-retention') {
        runScenario('retention');
        scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'scenario-efficiency') {
        runScenario('efficiency');
        scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'board-export') {
        handleExportBoard();
        return;
      }
      if (action === 'print-executive') {
        handlePrintExecutive();
        return;
      }
      if (action === 'weekly-pack') {
        handleExportWeeklyPack();
        return;
      }
      if (action === 'monday-briefing') {
        handleAutoMondayBriefing();
        weeklyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'reset-intelligence') {
        handleResetIntelligence();
        executiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'autopilot') {
        applyQuickRange(30);
        setStatusFilter('pending');
        setAlertRules((prev) => ({
          ...prev,
          minCompletionRate: Math.max(75, prev.minCompletionRate),
          maxCancellationRate: Math.min(22, prev.maxCancellationRate),
        }));
        setSimulator((prev) => ({
          ...prev,
          extraAppointments: Math.max(prev.extraAppointments, 20),
          completionLift: Math.max(prev.completionLift, 8),
        }));
        return;
      }
      if (action === 'clear') {
        clearFilters();
      }
    };

    const urlAction = new URLSearchParams(location.search).get('cp_action');
    if (urlAction) {
      runReportsCommand(urlAction);
      navigate(location.pathname, { replace: true });
    }

    const onCommandEvent = (event) => {
      const action = event?.detail?.action;
      runReportsCommand(action);
    };

    window.addEventListener('reports:command', onCommandEvent);
    return () => window.removeEventListener('reports:command', onCommandEvent);
  }, [location.pathname, location.search, navigate, handleExportCsv, runScenario, handleExportBoard, handlePrintExecutive, handleExportWeeklyPack, handleAutoMondayBriefing, handleCopyAutoBrief, handleResetIntelligence, handleGenerateEmailHtml, handleSendBriefEmail, handleRunRecoveryPlan, handleExportFhirBundle, handleExportFhirEventLog, handleToggleFeedReplay, handleResetFeedReplay, handleGenerateIntegrityHash, handleExportComplianceAudit, handleSignExecutivePackage, handleVerifyExecutiveSignature, handleExportSignedPackage, handleSimulatePackageTamper, handleExportAuditChainManifest, handleImportAuditChainManifest, handleRotateSigningKey, handleApplyDtxPolicy, handleExportDtxPolicy, handleImportDtxPolicy, handleResetDtxPolicyDefault, handleExportSignedDtxPolicyBundle, handleVerifySignedDtxPolicyBundle, handleMarkDtxPolicyReviewed, handleMarkDtxPolicyApproved, handleExportOutreachPlan, handleApplyOutreachRebalance, handlePreviewOutreachRebalance, handleRollbackOutreachRebalance]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="reports-content">
          <div className="reports-card">
            <h2 className="reports-title reports-title-lg">Clinic Reports</h2>
            <div className="reports-source-chip">{loadingSource ? 'Loading data source...' : sourceLabel}</div>
            <div className="reports-filters reports-filters-start">
              <button className="reports-export-btn" onClick={handleExportCsv}>
                <span className="reports-export-icon">⬇️</span> Export CSV
              </button>
              <label>From: <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({...r, from: e.target.value}))} /></label>
              <label>To: <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({...r, to: e.target.value}))} /></label>
              <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
                <option value="">All Doctors</option>
                {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
                <option value="">All Services</option>
                {serviceList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                {statusList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="reports-quick-range">
              <button type="button" className="reports-chip-btn" onClick={() => applyQuickRange(30)}>Last 30 Days</button>
              <button type="button" className="reports-chip-btn" onClick={() => applyQuickRange(90)}>Last 90 Days</button>
              <button type="button" className="reports-chip-btn" onClick={() => applyQuickRange(180)}>Last 180 Days</button>
              <button type="button" className="reports-chip-btn" onClick={applyYearToDate}>YTD</button>
              <button type="button" className="reports-chip-btn reports-chip-btn-light" onClick={clearFilters}>Clear Filters</button>
            </div>

            <section className="reports-presets">
              <h3 className="reports-chart-title">Saved Views</h3>
              <div className="reports-presets-row">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Name this filter view (e.g. Cardio Q3 Risk)"
                />
                <button type="button" onClick={handleSavePreset} disabled={!presetName.trim()}>Save View</button>
                <select value={selectedPresetId} onChange={(e) => handleApplyPreset(e.target.value)}>
                  <option value="">Select saved view</option>
                  {savedPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>
              {savedPresets.length > 0 && (
                <div className="reports-preset-tags">
                  {savedPresets.map((preset) => (
                    <div key={preset.id} className="reports-preset-tag">
                      <button type="button" className="reports-preset-tag-main" onClick={() => handleApplyPreset(preset.id)}>{preset.name}</button>
                      <button type="button" className="reports-preset-tag-remove" onClick={() => handleDeletePreset(preset.id)} aria-label={`Delete preset ${preset.name}`}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="reports-summary-row reports-summary-row-wide">
              <div className="reports-summary-card reports-summary-card-primary">
                <div className="reports-summary-title reports-summary-title-lg">Summary</div>
                <ul className="reports-summary-list reports-summary-list-lg">
                  <li className="reports-list-item-spaced">Total patients: <b>{totalPatients}</b></li>
                  <li className="reports-list-item-spaced">Total appointments: <b>{totalAppointments}</b></li>
                  <li className="reports-list-item-spaced">Total revenue: <b>{formatNumber(totalRevenue)} đ</b></li>
                  <li className="reports-list-item-spaced">Latest completion rate: <b>{latestMonth?.completionRate ?? 0}%</b></li>
                  <li>Cohort retention: <b>{latestCohort?.retentionRate ?? 0}%</b></li>
                </ul>
              </div>
              <div className="reports-summary-card reports-summary-card-secondary">
                <div className="reports-summary-title reports-summary-title-lg">Doctor KPI</div>
                <div className="reports-table-scroll">
                  <table className="reports-kpi-table reports-kpi-table-md">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Specialty</th>
                        <th>Appointments</th>
                        <th>Revenue</th>
                        <th>Completion</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorStats.map(doc => (
                        <tr key={doc.id}>
                          <td>{doc.name}</td>
                          <td>{doc.specialty}</td>
                          <td>{doc.appointments}</td>
                          <td>{formatNumber(doc.revenue)} đ</td>
                          <td>{doc.completionRate}%</td>
                          <td>{doc.rating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="reports-summary-card reports-summary-card-compare">
                <div className="reports-summary-title reports-summary-title-lg">Compare vs Previous Period</div>
                <div className="reports-compare-grid">
                  <div className="reports-compare-item">
                    <span>Appointments</span>
                    <b>{comparisonMetrics.current.appointments}</b>
                    <small className={comparisonMetrics.deltas.appointments >= 0 ? 'delta-up' : 'delta-down'}>
                      {comparisonMetrics.deltas.appointments >= 0 ? '+' : ''}{comparisonMetrics.deltas.appointments}%
                    </small>
                  </div>
                  <div className="reports-compare-item">
                    <span>Revenue</span>
                    <b>{formatNumber(comparisonMetrics.current.revenue)} đ</b>
                    <small className={comparisonMetrics.deltas.revenue >= 0 ? 'delta-up' : 'delta-down'}>
                      {comparisonMetrics.deltas.revenue >= 0 ? '+' : ''}{comparisonMetrics.deltas.revenue}%
                    </small>
                  </div>
                  <div className="reports-compare-item">
                    <span>Completion</span>
                    <b>{comparisonMetrics.current.completionRate}%</b>
                    <small className={comparisonMetrics.deltas.completionRate >= 0 ? 'delta-up' : 'delta-down'}>
                      {comparisonMetrics.deltas.completionRate >= 0 ? '+' : ''}{comparisonMetrics.deltas.completionRate}pt
                    </small>
                  </div>
                  <div className="reports-compare-item">
                    <span>Unique Patients</span>
                    <b>{comparisonMetrics.current.patients}</b>
                    <small className={comparisonMetrics.deltas.patients >= 0 ? 'delta-up' : 'delta-down'}>
                      {comparisonMetrics.deltas.patients >= 0 ? '+' : ''}{comparisonMetrics.deltas.patients}%
                    </small>
                  </div>
                </div>
              </div>
            </div>

            <section className="reports-executive" ref={executiveRef}>
              <h3 className="reports-chart-title">Executive Command Center</h3>
              <div className="reports-executive-actions">
                <button type="button" onClick={handleExportBoard}>Export Board Snapshot</button>
                <button type="button" onClick={handlePrintExecutive}>Print Executive Page</button>
                <button type="button" onClick={handleResetIntelligence}>Reset Intelligence</button>
              </div>
              <div className="reports-executive-grid">
                <div className="reports-executive-card">
                  <span>Operational Risk Index</span>
                  <b className={executiveSnapshot.riskIndex >= 65 ? 'delta-down' : 'delta-up'}>{executiveSnapshot.riskIndex}</b>
                </div>
                <div className="reports-executive-card">
                  <span>Growth Opportunity Index</span>
                  <b>{executiveSnapshot.growthIndex}</b>
                </div>
                <div className="reports-executive-card">
                  <span>Execution Readiness</span>
                  <b>{executiveSnapshot.executionIndex}</b>
                </div>
              </div>
              <div className="reports-executive-note">
                <p><b>Decision:</b> {executiveSnapshot.decision}</p>
                <p><b>Top Focus:</b> {executiveSnapshot.topFocus}</p>
              </div>
            </section>

            <section className="reports-scenarios" ref={scenarioRef}>
              <h3 className="reports-chart-title">Scenario Library and Strategy Runner</h3>
              <div className="reports-scenario-grid">
                <article className="reports-scenario-card">
                  <h4>Growth Acceleration</h4>
                  <p>Expand completed demand, increase average fee quality mix, and scale digital capacity.</p>
                  <button type="button" onClick={() => runScenario('growth')}>Run Scenario</button>
                </article>
                <article className="reports-scenario-card">
                  <h4>Retention Rescue</h4>
                  <p>Prioritize pending journeys, stricter retention targets, and stronger recall operations.</p>
                  <button type="button" onClick={() => runScenario('retention')}>Run Scenario</button>
                </article>
                <article className="reports-scenario-card">
                  <h4>Efficiency Maximizer</h4>
                  <p>Lower cancellations, improve completion throughput, and optimize doctor-hour utilization.</p>
                  <button type="button" onClick={() => runScenario('efficiency')}>Run Scenario</button>
                </article>
              </div>
            </section>

            <section className="reports-scenario-comparison" ref={comparisonRef}>
              <h3 className="reports-chart-title">Scenario Comparison Matrix</h3>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-lg">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Projected Appointments</th>
                      <th>Projected Revenue</th>
                      <th>Projected Completion</th>
                      <th>Projected Risk</th>
                      <th>Scenario Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioComparisons.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.projectedAppointments}</td>
                        <td>{formatNumber(item.projectedRevenue)} đ</td>
                        <td>{item.projectedCompletion}%</td>
                        <td>{item.projectedRisk}</td>
                        <td><b>{item.score}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-ai-briefing" ref={briefingRef}>
              <h3 className="reports-chart-title">AI Briefing (Executive 5-Line)</h3>
              <div className="reports-weekly-actions">
                <button type="button" onClick={handleCopyAutoBrief}>Copy Auto-Brief</button>
                <button type="button" onClick={handleGenerateEmailHtml}>Generate Email HTML</button>
                <button type="button" onClick={handleSendBriefEmail}>Send via Email</button>
                <button type="button" onClick={handleGenerateIntegrityHash}>Generate Integrity Hash</button>
              </div>
              <div className="reports-email-controls">
                <select value={selectedEmailProfile} onChange={(e) => setSelectedEmailProfile(e.target.value)}>
                  {Object.entries(EMAIL_RECIPIENT_PROFILES).map(([id, profile]) => (
                    <option key={id} value={id}>{profile.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={customEmailTo}
                  onChange={(e) => setCustomEmailTo(e.target.value)}
                  placeholder={`To override (default: ${EMAIL_RECIPIENT_PROFILES[selectedEmailProfile]?.to.join(', ') || ''})`}
                />
                <input
                  type="text"
                  value={customEmailCc}
                  onChange={(e) => setCustomEmailCc(e.target.value)}
                  placeholder={`CC override (default: ${EMAIL_RECIPIENT_PROFILES[selectedEmailProfile]?.cc.join(', ') || ''})`}
                />
                <button type="button" className="reports-email-reset-btn" onClick={handleResetEmailRecipients}>Reset Recipients</button>
              </div>
              {briefCopyStatus && <p className="reports-brief-status">{briefCopyStatus}</p>}
              {emailTemplateStatus && <p className="reports-email-status">{emailTemplateStatus}</p>}
              <ol>
                {aiBriefing.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </section>

            <section className="reports-compliance-cockpit" ref={complianceRef}>
              <h3 className="reports-chart-title">Global Compliance and Interoperability Cockpit</h3>
              <input
                ref={manifestFileInputRef}
                type="file"
                accept="application/json"
                className="reports-hidden-input"
                onChange={handleManifestFileChange}
              />
              <div className="reports-weekly-actions">
                <button type="button" onClick={handleExportFhirBundle}>Export FHIR R4 Bundle</button>
                <button type="button" onClick={handleGenerateIntegrityHash}>Refresh SHA-256 Package Hash</button>
                <button type="button" onClick={handleRotateSigningKey}>Rotate Signing Key</button>
                <button type="button" onClick={handleSignExecutivePackage}>Sign Executive Package</button>
                <button type="button" onClick={handleVerifyExecutiveSignature}>Verify Signature</button>
                <button type="button" onClick={handleExportSignedPackage}>Export Signed Package</button>
                <button type="button" onClick={handleSimulatePackageTamper}>Simulate Tamper</button>
                <button type="button" onClick={handleExportAuditChainManifest}>Export Chain Manifest</button>
                <button type="button" onClick={handleImportAuditChainManifest}>Import Chain Manifest</button>
                <button type="button" onClick={handleExportComplianceAudit}>Export Compliance Audit</button>
              </div>
              <div className="reports-keyring-row">
                <select
                  value={activeSigningKeyId}
                  onChange={(e) => setActiveSigningKeyId(e.target.value)}
                >
                  <option value="">Auto-select active key</option>
                  {signingKeyRing.map((key) => (
                    <option key={key.id} value={key.id}>{key.id}</option>
                  ))}
                </select>
                <span>Keys available: {signingKeyRing.length}</span>
              </div>
              {fhirExportStatus && <p className="reports-email-status">{fhirExportStatus}</p>}
              {complianceStatus && <p className="reports-recovery-status">{complianceStatus}</p>}
              {signatureStatus && <p className="reports-recovery-status">{signatureStatus}</p>}
              {signatureVerifyStatus && <p className="reports-recovery-status">{signatureVerifyStatus}</p>}
              {packageIntegrityHash && (
                <p className="reports-integrity-hash">Package Hash: <code>{packageIntegrityHash}</code></p>
              )}
              {packageSignature && (
                <pre className="reports-signature-box">{packageSignature}</pre>
              )}
              {signatureVerificationDetails && (
                <div className="reports-verify-panel">
                  <h4>Verification Details</h4>
                  <div className="reports-verify-grid">
                    <p><b>Result:</b> {signatureVerificationDetails.result}</p>
                    <p><b>Key ID:</b> {signatureVerificationDetails.keyId}</p>
                    <p><b>Algorithm:</b> {signatureVerificationDetails.algorithm}</p>
                    <p><b>Key:</b> {signatureVerificationDetails.keyType} / {signatureVerificationDetails.keyCurve}</p>
                    <p><b>Signed At:</b> {signatureVerificationDetails.signedAt}</p>
                    <p><b>Verified At:</b> {signatureVerificationDetails.verifiedAt}</p>
                    <p><b>Signature Length:</b> {signatureVerificationDetails.signatureLength}</p>
                    <p><b>Payload SHA-256:</b> <code>{signatureVerificationDetails.payloadHash}</code></p>
                    <p><b>Audit Chain Root:</b> <code>{signatureVerificationDetails.chainRootHash}</code></p>
                  </div>
                </div>
              )}
              {manifestImportReport && (
                <div className="reports-verify-panel">
                  <h4>Imported Manifest Verification</h4>
                  <div className="reports-verify-grid">
                    <p><b>File:</b> {manifestImportReport.fileName}</p>
                    <p><b>Imported At:</b> {manifestImportReport.importedAt}</p>
                    <p><b>Entries:</b> {manifestImportReport.chainLength}</p>
                    <p><b>Key ID:</b> {manifestImportReport.activeKeyId}</p>
                    <p><b>Signature:</b> {manifestImportReport.signatureResult}</p>
                    <p><b>Root Hash:</b> <code>{manifestImportReport.chainRootHash}</code></p>
                  </div>
                </div>
              )}
              <div className="reports-compliance-grid">
                {complianceChecks.map((item) => (
                  <article key={item.id} className="reports-compliance-card">
                    <h4>{item.framework}</h4>
                    <p><b>Score:</b> {item.score}/100 ({item.level})</p>
                    <p><b>Owner:</b> {item.owner}</p>
                    <p><b>Control Focus:</b> {item.controlFocus}</p>
                    <p><b>Evidence:</b> {item.evidence}</p>
                  </article>
                ))}
              </div>
              <p className="reports-weekly-meta">FHIR payload: {fhirBundle.total} resources (Patient, Practitioner, Encounter, Appointment) aligned to HL7 FHIR R4 conventions.</p>
              <p className="reports-weekly-meta">Compliance audit chain entries ready: {complianceAuditChain.length} (root: {complianceChainRootHash}).</p>
              {complianceAuditChain.length > 0 && (
                <div className="reports-audit-chain-table">
                  <h4>Immutable Audit Chain (Latest 5)</h4>
                  <div className="reports-table-scroll">
                    <table className="reports-kpi-table reports-kpi-table-md">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Domain</th>
                          <th>Previous Hash</th>
                          <th>Entry Hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {complianceAuditChain.slice(-5).reverse().map((item) => (
                          <tr key={`${item.chainIndex}-${item.entryHash}`}>
                            <td>{item.chainIndex}</td>
                            <td>{item.domain}</td>
                            <td><code>{item.previousHash}</code></td>
                            <td><code>{item.entryHash}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="reports-delta-tracker" ref={deltaRef}>
              <h3 className="reports-chart-title">Scenario Delta Tracker</h3>
              {driftTrendSeries.length > 0 && (
                <div className="reports-drift-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={driftTrendSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="left" domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="score" stroke="var(--brand-700)" strokeWidth={2.5} name="Scenario score" />
                      <Line yAxisId="right" type="monotone" dataKey="revenueK" stroke="var(--chart-violet)" strokeWidth={2.5} name="Revenue (K VND)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="reports-root-cause-panel">
                <h4>Drift Root-Cause Panel</h4>
                <div className="reports-root-cause-grid">
                  {driftRootCauses.map((item) => (
                    <article key={item.key} className="reports-root-cause-card">
                      <p className="reports-root-cause-title">{item.factor}</p>
                      <p className="reports-root-cause-signal">{item.signal}</p>
                      <div className="reports-root-cause-meta">
                        <span>Impact: {item.impact}</span>
                        <b>{item.impact >= 70 ? 'Critical' : item.impact >= 40 ? 'Watch' : 'Stable'}</b>
                      </div>
                      <p className="reports-root-cause-action">{item.action}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="reports-recovery-plan" ref={recoveryRef}>
                <div className="reports-recovery-head">
                  <h4>One-Click Recovery Plan</h4>
                  <button type="button" onClick={handleRunRecoveryPlan}>Activate Recovery Mode</button>
                </div>
                {recoveryStatus && <p className="reports-recovery-status">{recoveryStatus}</p>}
                <ul className="reports-recovery-list">
                  {recoveryPlan.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <span>{item.task}</span>
                      <small>Owner: {item.owner} | ETA: {item.eta} | Expected: {item.expectedLift}</small>
                    </li>
                  ))}
                </ul>
              </div>
              {scenarioDriftAlerts.length > 0 && (
                <ul className="reports-drift-alert-list">
                  {scenarioDriftAlerts.map((alert) => (
                    <li key={`${alert.scenario}-${alert.latestAt}`} className={`reports-drift-alert ${alert.severity === 'high' ? 'drift-high' : 'drift-medium'}`}>
                      <strong>{alert.scenario}</strong>
                      <span>Score delta {alert.scoreDelta >= 0 ? '+' : ''}{alert.scoreDelta}; revenue delta {alert.revenueDelta >= 0 ? '+' : ''}{formatNumber(alert.revenueDelta)} đ</span>
                    </li>
                  ))}
                </ul>
              )}
              {scenarioHistory.length === 0 ? (
                <p className="reports-anomaly-empty">No scenario run tracked yet. Run a scenario to populate this tracker.</p>
              ) : (
                <div className="reports-table-scroll">
                  <table className="reports-kpi-table reports-kpi-table-lg">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Scenario</th>
                        <th>Score</th>
                        <th>Projected Revenue</th>
                        <th>Projected Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.timestamp}</td>
                          <td>{item.name}</td>
                          <td><b>{item.score}</b></td>
                          <td>{formatNumber(Number(item.projectedRevenue || 0))} đ</td>
                          <td>{item.projectedCompletion}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="reports-weekly-briefing" ref={weeklyRef}>
              <h3 className="reports-chart-title">Weekly Briefing Template</h3>
              <div className="reports-weekly-actions">
                <button type="button" onClick={handleExportWeeklyPack}>Export Weekly Pack</button>
                <button type="button" onClick={handleAutoMondayBriefing}>Auto Monday Briefing</button>
              </div>
              <div className="reports-weekly-meta">{weeklyBriefingTemplate.period}</div>
              <div className="reports-weekly-grid">
                <div>
                  <h4>Key Wins</h4>
                  <ul>
                    {weeklyBriefingTemplate.keyWins.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Key Risks</h4>
                  <ul>
                    {weeklyBriefingTemplate.keyRisks.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Next Actions</h4>
                  <ul>
                    {weeklyBriefingTemplate.nextActions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </section>

            <section className="reports-chart-grid">
              <div className="reports-chart-card">
                <h3 className="reports-chart-title">Volume Trend (3-month smoothing + confidence band)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={effectiveMonthlySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="lower" stackId="band" stroke="none" fill="transparent" name="Lower CI" />
                    <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill="rgba(10,126,164,0.14)" name="Confidence band" />
                    <Bar dataKey="appointments" fill="var(--brand-500)" radius={[6, 6, 0, 0]} name="Appointments" />
                    <Line type="monotone" dataKey="trend" stroke="var(--brand-700)" strokeWidth={3} dot={false} name="3M trend" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="reports-chart-card">
                <h3 className="reports-chart-title">Cohort Quality (new vs returning patients)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={effectiveCohortSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="newPatients" stackId="a" fill="var(--success-fg)" name="New patients" />
                    <Bar yAxisId="left" dataKey="returningPatients" stackId="a" fill="var(--chart-sky)" name="Returning patients" />
                    <Line yAxisId="right" type="monotone" dataKey="retentionRate" stroke="var(--danger-fg)" strokeWidth={2.5} name="Retention rate" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="reports-chart-card reports-chart-card-full">
                <h3 className="reports-chart-title">Revenue and Completion Quality</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={effectiveMonthlySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="var(--chart-violet)" name="Revenue (VND)" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="var(--success-fg)" strokeWidth={2.5} name="Completion rate" />
                    <Line yAxisId="right" type="monotone" dataKey="cancellationRate" stroke="var(--chart-orange)" strokeWidth={2.5} name="Cancellation rate" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="reports-ai-notes">
              <h3 className="reports-chart-title">AI Analytics Notes (Explainable)</h3>
              <ul>
                {aiNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>

            <section className="reports-alert-center" ref={alertCenterRef}>
              <h3 className="reports-chart-title">Smart Alert Center</h3>
              <div className="reports-alert-rules">
                <label>
                  Min completion %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={alertRules.minCompletionRate}
                    onChange={(e) => setAlertRules((prev) => ({ ...prev, minCompletionRate: Number(e.target.value || 0) }))}
                  />
                </label>
                <label>
                  Max cancellation %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={alertRules.maxCancellationRate}
                    onChange={(e) => setAlertRules((prev) => ({ ...prev, maxCancellationRate: Number(e.target.value || 0) }))}
                  />
                </label>
                <label>
                  Min retention %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={alertRules.minRetentionRate}
                    onChange={(e) => setAlertRules((prev) => ({ ...prev, minRetentionRate: Number(e.target.value || 0) }))}
                  />
                </label>
              </div>
              {alertSignals.length === 0 ? (
                <p className="reports-anomaly-empty">No threshold breach detected under current rule set.</p>
              ) : (
                <ul className="reports-alert-list">
                  {alertSignals.map((signal) => (
                    <li key={signal.key} className={`reports-alert-item ${signal.severity === 'high' ? 'alert-high' : 'alert-medium'}`}>
                      <strong>{signal.title}</strong>
                      <span>{signal.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="reports-simulator" ref={simulatorRef}>
              <h3 className="reports-chart-title">What-if Revenue Simulator</h3>
              <div className="reports-simulator-controls">
                <label>
                  Extra appointments
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simulator.extraAppointments}
                    onChange={(e) => setSimulator((prev) => ({ ...prev, extraAppointments: Number(e.target.value) }))}
                  />
                  <b>{simulator.extraAppointments}</b>
                </label>
                <label>
                  Avg fee (VND)
                  <input
                    type="range"
                    min="100000"
                    max="500000"
                    step="10000"
                    value={simulator.avgFee}
                    onChange={(e) => setSimulator((prev) => ({ ...prev, avgFee: Number(e.target.value) }))}
                  />
                  <b>{formatNumber(simulator.avgFee)}</b>
                </label>
                <label>
                  Completion uplift
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={simulator.completionLift}
                    onChange={(e) => setSimulator((prev) => ({ ...prev, completionLift: Number(e.target.value) }))}
                  />
                  <b>{simulator.completionLift >= 0 ? '+' : ''}{simulator.completionLift}pt</b>
                </label>
              </div>
              <div className="reports-simulator-cards">
                <div>
                  <span>Baseline Revenue</span>
                  <b>{formatNumber(whatIfProjection.baselineRevenue)} đ</b>
                </div>
                <div>
                  <span>Projected Revenue</span>
                  <b>{formatNumber(whatIfProjection.projectedRevenue)} đ</b>
                </div>
                <div>
                  <span>Revenue Delta</span>
                  <b className={whatIfProjection.revenueDelta >= 0 ? 'delta-up' : 'delta-down'}>
                    {whatIfProjection.revenueDelta >= 0 ? '+' : ''}{formatNumber(whatIfProjection.revenueDelta)} đ
                  </b>
                </div>
                <div>
                  <span>Projected Completion</span>
                  <b>{whatIfProjection.projectedCompletion}%</b>
                </div>
              </div>
            </section>

            <section className="reports-copilot">
              <h3 className="reports-chart-title">AI Copilot (Natural Language Analytics)</h3>
              <form className="reports-copilot-form" onSubmit={handleAskCopilot}>
                <input
                  ref={copilotInputRef}
                  type="text"
                  value={copilotQuestion}
                  onChange={(e) => setCopilotQuestion(e.target.value)}
                  placeholder="Ask: Which doctor has the highest cancellation risk this quarter?"
                />
                <button type="submit" disabled={copilotLoading}>{copilotLoading ? 'Analyzing...' : 'Ask Copilot'}</button>
              </form>
              {copilotAnswer && <p className="reports-copilot-answer">{copilotAnswer}</p>}
              {copilotHighlights.length > 0 && (
                <ul className="reports-copilot-highlights">
                  {copilotHighlights.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>

            <section className="reports-anomaly-section">
              <h3 className="reports-chart-title">Anomaly Detection (Doctor/Service)</h3>
              {!anomalySignals.length ? (
                <p className="reports-anomaly-empty">No major anomaly signal detected for current filters.</p>
              ) : (
                <div className="reports-table-scroll">
                  <table className="reports-kpi-table reports-kpi-table-lg">
                    <thead>
                      <tr>
                        <th>Severity</th>
                        <th>Type</th>
                        <th>Doctor</th>
                        <th>Service</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalySignals.map((row) => (
                        <tr key={`${row.type}-${row.doctor}-${row.service}-${row.detail}`}>
                          <td>
                            <span className={`severity-badge severity-${row.severity}`}>{row.severity}</span>
                          </td>
                          <td>{row.type}</td>
                          <td>{row.doctor}</td>
                          <td>{row.service}</td>
                          <td className="reports-cell-left">{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="reports-quality-lab" ref={qualityRef}>
              <h3 className="reports-chart-title">Data Quality Score Lab</h3>
              <div className="reports-quality-score-row">
                <div className="reports-quality-score-card">
                  <span>Trust Score</span>
                  <b>{dataQuality.score}/100</b>
                  <small>Grade {dataQuality.grade}</small>
                </div>
                <div className="reports-quality-metrics">
                  <div><span>Missing Service</span><b>{dataQuality.missingService}</b></div>
                  <div><span>Missing Fee</span><b>{dataQuality.missingFee}</b></div>
                  <div><span>Invalid Date</span><b>{dataQuality.invalidDate}</b></div>
                  <div><span>Duplicates</span><b>{dataQuality.duplicatePairs}</b></div>
                </div>
              </div>
              <ul className="reports-quality-issues">
                {dataQuality.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </section>

            <section className="reports-playbook" ref={playbookRef}>
              <h3 className="reports-chart-title">Autonomous Action Playbook</h3>
              <div className="reports-playbook-grid">
                {autonomousPlaybook.map((step) => (
                  <article key={step.key} className="reports-playbook-card">
                    <div className="reports-playbook-head">
                      <span className={`reports-priority reports-priority-${step.priority.toLowerCase()}`}>{step.priority}</span>
                      <h4>{step.title}</h4>
                    </div>
                    <p>{step.action}</p>
                    <small>{step.impact}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="reports-digital-twin" ref={twinRef}>
              <h3 className="reports-chart-title">Digital Twin Capacity Lab</h3>
              <div className="reports-twin-controls">
                <label>
                  Doctor working hours / month
                  <input
                    type="range"
                    min="80"
                    max="240"
                    value={digitalTwin.doctorHours}
                    onChange={(e) => setDigitalTwin((prev) => ({ ...prev, doctorHours: Number(e.target.value) }))}
                  />
                  <b>{digitalTwin.doctorHours}h</b>
                </label>
                <label>
                  No-show rate
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={digitalTwin.noShowRate}
                    onChange={(e) => setDigitalTwin((prev) => ({ ...prev, noShowRate: Number(e.target.value) }))}
                  />
                  <b>{digitalTwin.noShowRate}%</b>
                </label>
                <label>
                  AI automation level
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={digitalTwin.aiAutomation}
                    onChange={(e) => setDigitalTwin((prev) => ({ ...prev, aiAutomation: Number(e.target.value) }))}
                  />
                  <b>{digitalTwin.aiAutomation}%</b>
                </label>
                <label>
                  Telehealth mix
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={digitalTwin.telehealthMix}
                    onChange={(e) => setDigitalTwin((prev) => ({ ...prev, telehealthMix: Number(e.target.value) }))}
                  />
                  <b>{digitalTwin.telehealthMix}%</b>
                </label>
              </div>
              <div className="reports-twin-metrics">
                <div><span>Capacity Ceiling</span><b>{digitalTwinProjection.capacity}</b></div>
                <div><span>Projected Visits</span><b>{digitalTwinProjection.projectedAppointments}</b></div>
                <div><span>Projected Completion</span><b>{digitalTwinProjection.projectedCompletion}%</b></div>
                <div><span>Projected Revenue</span><b>{formatNumber(digitalTwinProjection.projectedRevenue)} đ</b></div>
                <div><span>Utilization</span><b>{digitalTwinProjection.utilization}%</b></div>
                <div>
                  <span>Bottleneck Index</span>
                  <b className={digitalTwinProjection.riskBand === 'high' ? 'delta-down' : digitalTwinProjection.riskBand === 'medium' ? '' : 'delta-up'}>
                    {digitalTwinProjection.bottleneck}
                  </b>
                </div>
              </div>
            </section>

            <section className="reports-scheduler" ref={schedulerRef}>
              <h3 className="reports-chart-title">Auto-Scheduler Recommendation Engine</h3>
              {autoScheduleRecommendations.length === 0 ? (
                <p className="reports-anomaly-empty">Not enough data to generate doctor scheduling guidance.</p>
              ) : (
                <div className="reports-table-scroll">
                  <table className="reports-kpi-table reports-kpi-table-lg">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Priority</th>
                        <th>Recommended Slots</th>
                        <th>Telehealth Share</th>
                        <th>Follow-up Buffer</th>
                        <th>Focus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoScheduleRecommendations.map((row) => (
                        <tr key={row.doctor}>
                          <td>{row.doctor}</td>
                          <td>
                            <span className={`severity-badge ${row.priorityScore >= 70 ? 'severity-high' : 'severity-medium'}`}>
                              {row.priorityScore}
                            </span>
                          </td>
                          <td>{row.recommendedSlots}</td>
                          <td>{row.telehealthShare}%</td>
                          <td>{row.followupBuffer}%</td>
                          <td>{row.serviceFocus || 'General mix'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="reports-trajectory" ref={trajectoryRef}>
              <h3 className="reports-chart-title">Patient Risk Trajectory</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={patientRiskTrajectory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="high" stackId="risk" fill="var(--danger-fg)" name="High risk" />
                  <Bar yAxisId="left" dataKey="medium" stackId="risk" fill="var(--warning-fg)" name="Medium risk" />
                  <Bar yAxisId="left" dataKey="low" stackId="risk" fill="var(--success-fg)" name="Low risk" />
                  <Line yAxisId="right" type="monotone" dataKey="riskPressure" stroke="var(--brand-700)" strokeWidth={2.5} name="Risk pressure" />
                </ComposedChart>
              </ResponsiveContainer>
            </section>

            <section className="reports-precision-twin" ref={precisionRef}>
              <h3 className="reports-chart-title">Precision Health Risk Twin</h3>
              <div className="reports-executive-grid">
                <div className="reports-executive-card">
                  <span>High-Risk Patients</span>
                  <b className={precisionTwinSummary.highRiskPatients > 0 ? 'delta-down' : ''}>{precisionTwinSummary.highRiskPatients}</b>
                </div>
                <div className="reports-executive-card">
                  <span>Medium-Risk Patients</span>
                  <b>{precisionTwinSummary.mediumRiskPatients}</b>
                </div>
                <div className="reports-executive-card">
                  <span>Average Risk Score</span>
                  <b>{precisionTwinSummary.averageRiskScore}</b>
                </div>
              </div>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-lg">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Risk Score</th>
                      <th>Band</th>
                      <th>Care Gap (days)</th>
                      <th>Completion</th>
                      <th>Next Best Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precisionCareRows.slice(0, 8).map((row) => (
                      <tr key={row.patient}>
                        <td>{row.patient}</td>
                        <td><b>{row.riskScore}</b></td>
                        <td>
                          <span className={`severity-badge ${row.riskBand === 'high' ? 'severity-high' : 'severity-medium'}`}>
                            {row.riskBand}
                          </span>
                        </td>
                        <td>{row.careGapDays}</td>
                        <td>{row.completionRate}%</td>
                        <td className="reports-cell-left">{row.nextBestAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-rpm-center" ref={rpmRef}>
              <h3 className="reports-chart-title">Remote Monitoring Command Center</h3>
              <div className="reports-rpm-grid">
                {remoteMonitoringCohort.map((row) => (
                  <article key={row.patient} className="reports-rpm-card">
                    <h4>{row.patient}</h4>
                    <p><b>Telemetry:</b> {row.liveSignal}</p>
                    <p><b>Device Uptime:</b> {row.deviceUptime}%</p>
                    <p><b>Adherence:</b> {row.adherence}%</p>
                    <p><b>Next Check-in:</b> {row.nextCheckinHours}h</p>
                  </article>
                ))}
              </div>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-md">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Patient</th>
                      <th>Signal</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remoteMonitoringAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="reports-cell-left">No active RPM alerts in current cohort.</td>
                      </tr>
                    ) : remoteMonitoringAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td><span className={`severity-badge severity-${alert.severity}`}>{alert.severity}</span></td>
                        <td>{alert.patient}</td>
                        <td>{alert.signal}</td>
                        <td className="reports-cell-left">{alert.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-pathway-orchestrator" ref={pathwayRef}>
              <h3 className="reports-chart-title">Clinical Pathway Orchestrator</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={clinicalPathwayRows.slice(0, 6)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pathwayMaturity" fill="var(--brand-500)" name="Pathway maturity" />
                  <Bar dataKey="automationCoverage" fill="var(--success-fg)" name="Automation" />
                  <Bar dataKey="telehealthFit" fill="var(--warning-fg)" name="Telehealth fit" />
                </BarChart>
              </ResponsiveContainer>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-lg">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Maturity</th>
                      <th>Automation</th>
                      <th>Telehealth Fit</th>
                      <th>Completion</th>
                      <th>Cancellation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicalPathwayRows.map((row) => (
                      <tr key={row.service}>
                        <td>{row.service}</td>
                        <td><b>{row.pathwayMaturity}</b></td>
                        <td>{row.automationCoverage}%</td>
                        <td>{row.telehealthFit}%</td>
                        <td>{row.completionRate}%</td>
                        <td>{row.cancellationRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-subscription-feed" ref={subscriptionRef}>
              <h3 className="reports-chart-title">FHIR Subscription Live Feed</h3>
              <div className="reports-weekly-actions">
                <button type="button" onClick={handleExportFhirEventLog}>Export Event Log (NDJSON)</button>
                <button type="button" onClick={handleToggleFeedReplay}>{feedReplayActive ? 'Pause Replay' : 'Start Replay'}</button>
                <button type="button" onClick={handleResetFeedReplay}>Reset Replay</button>
                <label className="reports-feed-replay-speed">
                  Replay Speed (ms)
                  <input
                    type="number"
                    min="300"
                    step="100"
                    value={feedReplayIntervalMs}
                    onChange={(e) => setFeedReplayIntervalMs(Number(e.target.value) || 1200)}
                  />
                </label>
              </div>
              {feedReplayActive && (
                <p className="reports-brief-status">
                  Replay mode active: showing {replayFeedEvents.length}/{fhirSubscriptionFeed.length} events.
                </p>
              )}
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-lg">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Topic</th>
                      <th>Event</th>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Resource</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replayFeedEvents.map((event) => (
                      <tr key={event.id}>
                        <td>{event.eventTime.slice(11, 19)}</td>
                        <td>{event.topic}</td>
                        <td>{event.eventType}</td>
                        <td>{event.patient}</td>
                        <td>{event.doctor}</td>
                        <td><code>{event.payloadRef}</code></td>
                        <td><span className={`severity-badge severity-${event.severity}`}>{event.severity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-dtx-coach" ref={dtxRef}>
              <h3 className="reports-chart-title">Digital Therapeutics Coach</h3>
              <div className="reports-dtx-policy">
                <h4>Rules Engine Policy (JSON)</h4>
                <div className="reports-dtx-version-bar">
                  <select
                    value={selectedDtxPolicyVersionId}
                    onChange={(e) => handleLoadDtxPolicyVersion(e.target.value)}
                  >
                    <option value="">Select policy version</option>
                    {dtxPolicyHistory.map((version) => (
                      <option key={version.id} value={version.id}>{version.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handlePublishDtxPolicyVersion}>Publish Version</button>
                </div>
                  <div className="reports-weekly-actions">
                    <button type="button" onClick={handleApplyDtxPolicy}>Apply DTx Rules</button>
                    <button type="button" onClick={handleExportDtxPolicy}>Export Policy JSON</button>
                    <button type="button" onClick={handleImportDtxPolicy}>Import Policy JSON</button>
                    <button type="button" onClick={handleResetDtxPolicyDefault}>Reset Default</button>
                    <button type="button" onClick={handleExportSignedDtxPolicyBundle}>Export Signed Bundle</button>
                    <button type="button" onClick={handleVerifySignedDtxPolicyBundle}>Verify Signed Bundle</button>
                    <button type="button" onClick={handleMarkDtxPolicyReviewed}>Mark Reviewed</button>
                    <button
                      type="button"
                      onClick={handleMarkDtxPolicyApproved}
                      disabled={dtxPolicyVerifyReport?.result !== 'valid'}
                      title={dtxPolicyVerifyReport?.result === 'valid' ? 'Verification passed' : 'Verify signed bundle before approval'}
                    >
                      Mark Approved
                    </button>
                  </div>
                  <input
                    ref={dtxPolicyFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={handleDtxPolicyFileChange}
                  />
                  <input
                    ref={dtxSignedBundleFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={handleDtxSignedBundleFileChange}
                  />
                <textarea
                  value={dtxPolicyDraft}
                  onChange={(e) => setDtxPolicyDraft(e.target.value)}
                  spellCheck={false}
                />
                {dtxPolicyStatus && <p className="reports-brief-status">{dtxPolicyStatus}</p>}
                {dtxPolicyBundleStatus && <p className="reports-email-status">{dtxPolicyBundleStatus}</p>}
                  {dtxPolicyVerifyStatus && <p className="reports-email-status">{dtxPolicyVerifyStatus}</p>}
                {dtxPolicyVerifyReport && (
                  <div className="reports-dtx-approval">
                    <h4>Signed Bundle Verification Report</h4>
                    <p><b>Result:</b> <span className={`severity-badge severity-${dtxPolicyVerifyReport.result === 'valid' ? 'low' : 'high'}`}>{dtxPolicyVerifyReport.result}</span></p>
                    <p><b>Key ID:</b> {dtxPolicyVerifyReport.keyId}</p>
                    <p><b>Algorithm:</b> {dtxPolicyVerifyReport.algorithm}</p>
                    <p><b>Hash Check:</b> {String(dtxPolicyVerifyReport.hashValid)}</p>
                    <p><b>Signature Check:</b> {String(dtxPolicyVerifyReport.signatureValid)}</p>
                    <p><b>Payload Hash:</b> <code>{dtxPolicyVerifyReport.payloadHash}</code></p>
                    <p><b>Verified At:</b> {formatDateByOptions(dtxPolicyVerifyReport.verifiedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  </div>
                )}
                  <div className="reports-dtx-approval">
                    <h4>Approval Workflow</h4>
                    <p><b>Status:</b> <span className={`severity-badge severity-${dtxPolicyApproval.status === 'approved' ? 'low' : dtxPolicyApproval.status === 'reviewed' ? 'medium' : 'high'}`}>{dtxPolicyApproval.status}</span></p>
                    <p><b>Reviewed At:</b> {dtxPolicyApproval.reviewedAt ? formatDateByOptions(dtxPolicyApproval.reviewedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}</p>
                    <p><b>Approved At:</b> {dtxPolicyApproval.approvedAt ? formatDateByOptions(dtxPolicyApproval.approvedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}</p>
                    <p><b>Note:</b> {dtxPolicyApproval.note || 'No governance note yet.'}</p>
                  </div>
                <div className="reports-dtx-diff">
                  <h4>Policy Diff Viewer</h4>
                  <div className="reports-dtx-version-bar">
                    <select
                      value={selectedDtxPolicyCompareId}
                      onChange={(e) => setSelectedDtxPolicyCompareId(e.target.value)}
                    >
                      <option value="">Compare against default baseline</option>
                      {dtxPolicyHistory.map((version) => (
                        <option key={`compare-${version.id}`} value={version.id}>{version.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="reports-table-scroll">
                    <table className="reports-kpi-table reports-kpi-table-md">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Baseline</th>
                          <th>Current</th>
                          <th>Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dtxPolicyDiffRows.map((row) => (
                          <tr key={`diff-${row.field}`}>
                            <td className="reports-cell-left">{row.field}</td>
                            <td>{row.baseline}</td>
                            <td>{row.current}</td>
                            <td className={row.delta > 0 ? 'delta-up' : row.delta < 0 ? 'delta-down' : ''}>{row.delta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="reports-dtx-diff">
                  <h4>Governance Audit Trail</h4>
                  <div className="reports-table-scroll">
                    <table className="reports-kpi-table reports-kpi-table-md">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Action</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {governanceAuditTrail.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="reports-cell-left">No governance actions logged yet.</td>
                          </tr>
                        ) : governanceAuditTrail.map((item) => (
                          <tr key={item.id}>
                            <td>{formatTimeShort(item.timestamp)}</td>
                            <td>{item.action}</td>
                            <td className="reports-cell-left">{item.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-lg">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Protocol</th>
                      <th>Coach Mode</th>
                      <th>Session Completion</th>
                      <th>Digital Engagement</th>
                      <th>Expected Outcome Gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {digitalTherapeuticsPrograms.map((row) => (
                      <tr key={`${row.patient}-${row.protocol}`}>
                        <td>{row.patient}</td>
                        <td>{row.protocol}</td>
                        <td>{row.aiCoachIntensity}</td>
                        <td>{row.sessionCompletion}%</td>
                        <td>{row.digitalEngagement}%</td>
                        <td className="delta-up">+{row.expectedOutcomeGain}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-population-health" ref={populationRef}>
              <h3 className="reports-chart-title">Population Health Stratification</h3>
              <div className="reports-outreach-capacity">
                <h4>Outreach Capacity Simulator</h4>
                <div className="reports-weekly-actions">
                  <button type="button" onClick={handleExportOutreachPlan}>Export Outreach Plan (CSV)</button>
                </div>
                <div className="reports-outreach-grid">
                  <label>
                    Care Managers
                    <input
                      type="number"
                      min="0"
                      value={outreachCapacity.careManagers}
                      onChange={(e) => setOutreachCapacity((prev) => ({ ...prev, careManagers: Number(e.target.value) }))}
                    />
                  </label>
                  <label>
                    Nurses
                    <input
                      type="number"
                      min="0"
                      value={outreachCapacity.nurses}
                      onChange={(e) => setOutreachCapacity((prev) => ({ ...prev, nurses: Number(e.target.value) }))}
                    />
                  </label>
                  <label>
                    Daily contacts / staff
                    <input
                      type="number"
                      min="1"
                      value={outreachCapacity.dailyContactsPerStaff}
                      onChange={(e) => setOutreachCapacity((prev) => ({ ...prev, dailyContactsPerStaff: Number(e.target.value) }))}
                    />
                  </label>
                  <label>
                    Urgent slots / day
                    <input
                      type="number"
                      min="0"
                      value={outreachCapacity.urgentSlotsPerDay}
                      onChange={(e) => setOutreachCapacity((prev) => ({ ...prev, urgentSlotsPerDay: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <div className="reports-simulator-cards">
                  <div><span>Total Staff</span><b>{outreachCapacityPlan.totalStaff}</b></div>
                  <div><span>Contacts / Day</span><b>{outreachCapacityPlan.contactsPerDay}</b></div>
                  <div><span>Queue Load</span><b>{outreachCapacityPlan.queueLoad}</b></div>
                  <div><span>Days to Clear Queue</span><b>{outreachCapacityPlan.daysToClear}</b></div>
                  <div><span>Urgent Demand</span><b>{outreachCapacityPlan.urgentDemand}</b></div>
                  <div><span>Urgent Overflow</span><b className={outreachCapacityPlan.urgentOverflow > 0 ? 'delta-down' : 'delta-up'}>{outreachCapacityPlan.urgentOverflow}</b></div>
                </div>
              </div>
              <div className="reports-population-grid">
                {populationStratification.map((segment) => (
                  <article key={segment.segment} className="reports-population-card">
                    <h4>{segment.segment}</h4>
                    <p><b>Patients:</b> {segment.patients}</p>
                    <p><b>Average Risk:</b> {segment.avgRisk}</p>
                    <p><b>Engagement:</b> {segment.engagement}%</p>
                    <p><b>Intervention:</b> {segment.interventions}</p>
                  </article>
                ))}
              </div>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-md">
                  <thead>
                    <tr>
                      <th>Queue</th>
                      <th>Patients</th>
                      <th>ETA</th>
                      <th>Severity</th>
                      <th>Intervention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreachQueue.map((item) => (
                      <tr key={item.id}>
                        <td>{item.segment}</td>
                        <td>{item.patients}</td>
                        <td>{item.etaHours}h</td>
                        <td><span className={`severity-badge severity-${item.severity}`}>{item.severity}</span></td>
                        <td className="reports-cell-left">{item.intervention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="reports-sla-forecast">
                <h4>Outreach SLA Breach Radar</h4>
                <div className="reports-table-scroll">
                  <table className="reports-kpi-table reports-kpi-table-md">
                    <thead>
                      <tr>
                        <th>Queue</th>
                        <th>SLA Target</th>
                        <th>Projected</th>
                        <th>Breach</th>
                        <th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outreachSlaForecast.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="reports-cell-left">No queue data available for SLA forecast.</td>
                        </tr>
                      ) : outreachSlaForecast.map((row) => (
                        <tr key={`${row.id}-sla`}>
                          <td>{row.segment}</td>
                          <td>{row.etaHours}h</td>
                          <td>{row.projectedHours}h</td>
                          <td>{row.breachHours}h</td>
                          <td><span className={`severity-badge severity-${row.breachRisk}`}>{row.breachRisk}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="reports-simulator-cards">
                  <div><span>Breached Queues</span><b>{outreachRebalancePlan.projectedBreaches}</b></div>
                  <div><span>Contact Deficit / Day</span><b>{outreachRebalancePlan.contactDeficit}</b></div>
                  <div><span>Recommended Additional Staff</span><b>{outreachRebalancePlan.additionalStaff}</b></div>
                  <div><span>Recommended Urgent Slots</span><b>{outreachRebalancePlan.additionalUrgentSlots}</b></div>
                </div>
                <div className="reports-weekly-actions">
                  <button type="button" onClick={handlePreviewOutreachRebalance}>
                    Preview Auto-Rebalance
                  </button>
                  <button type="button" onClick={handleApplyOutreachRebalance}>
                    Apply Auto-Rebalance Suggestion
                  </button>
                  <button type="button" onClick={handleRollbackOutreachRebalance}>
                    Rollback Last Rebalance
                  </button>
                </div>
                {outreachRebalancePreview && (
                  <div className="reports-simulator-cards">
                    <div><span>Preview +Care Managers</span><b>{outreachRebalancePreview.delta.careManagers}</b></div>
                    <div><span>Preview +Nurses</span><b>{outreachRebalancePreview.delta.nurses}</b></div>
                    <div><span>Preview +Urgent Slots</span><b>{outreachRebalancePreview.delta.urgentSlotsPerDay}</b></div>
                  </div>
                )}
              </div>
            </section>

            <section className="reports-benchmark" ref={benchmarkRef}>
              <h3 className="reports-chart-title">Multi-Clinic Benchmark Board</h3>
              <div className="reports-benchmark-grid">
                <div className="reports-chart-card">
                  <h4 className="reports-chart-title">Clinic Health Index</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={clinicBenchmarkRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="clinic" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="healthIndex" fill="var(--brand-500)" radius={[6, 6, 0, 0]} name="Health index" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="reports-table-scroll">
                  <table className="reports-kpi-table reports-kpi-table-lg">
                    <thead>
                      <tr>
                        <th>Clinic</th>
                        <th>Appointments</th>
                        <th>Revenue</th>
                        <th>Completion</th>
                        <th>Cancellation</th>
                        <th>Retention</th>
                        <th>Health Index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicBenchmarkRows.map((row) => (
                        <tr key={row.clinic}>
                          <td>{row.clinic}</td>
                          <td>{row.appointments}</td>
                          <td>{formatNumber(row.revenue)} đ</td>
                          <td>{row.completion}%</td>
                          <td>{row.cancellation}%</td>
                          <td>{row.retention}%</td>
                          <td><b>{row.healthIndex}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div className="reports-appointments-section">
              <h3 className="reports-appointments-title">Appointments Table</h3>
              <div className="reports-table-scroll">
                <table className="reports-kpi-table reports-kpi-table-xl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Service</th>
                      <th>Fee</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((a,i) => (
                      <tr key={i}>
                        <td>{a.date}</td>
                        <td>{a.patient}</td>
                        <td>{a.doctor}</td>
                        <td>{a.service}</td>
                        <td>{formatNumber(a.fee)} đ</td>
                        <td>{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Reports;
