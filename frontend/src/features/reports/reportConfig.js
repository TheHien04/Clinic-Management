export const REPORTS_PRESETS_KEY = 'reports_filter_presets_v1';
export const REPORTS_ALERT_RULES_KEY = 'reports_alert_rules_v1';
export const REPORTS_SCENARIO_HISTORY_KEY = 'reports_scenario_history_v1';
export const REPORTS_EMAIL_RECIPIENTS_KEY = 'reports_email_recipients_v1';
export const REPORTS_DTX_POLICY_KEY = 'reports_dtx_policy_v1';
export const REPORTS_DTX_POLICY_HISTORY_KEY = 'reports_dtx_policy_history_v1';
export const REPORTS_OUTREACH_CAPACITY_KEY = 'reports_outreach_capacity_v1';
export const REPORTS_DTX_APPROVAL_KEY = 'reports_dtx_approval_v1';
export const REPORTS_GOVERNANCE_AUDIT_KEY = 'reports_governance_audit_v1';

export const DEFAULT_DTX_POLICY = Object.freeze({
  sessionWeights: Object.freeze({
    completion: 0.35,
    engagement: 0.25,
    riskInverse: 0.4,
  }),
  riskThresholds: Object.freeze({
    high: 70,
    medium: 45,
  }),
  expectedGainOffset: 45,
  expectedGainClamp: Object.freeze({
    min: 2,
    max: 48,
  }),
});

export const EMAIL_RECIPIENT_PROFILES = Object.freeze({
  leadership: Object.freeze({
    label: 'Leadership (CEO/COO/Ops Lead)',
    to: Object.freeze(['ceo@clinic.local']),
    cc: Object.freeze(['coo@clinic.local', 'opslead@clinic.local']),
  }),
  operations: Object.freeze({
    label: 'Operations Board',
    to: Object.freeze(['opslead@clinic.local']),
    cc: Object.freeze(['scheduler@clinic.local', 'carequality@clinic.local']),
  }),
  finance: Object.freeze({
    label: 'Finance and Strategy',
    to: Object.freeze(['finance@clinic.local']),
    cc: Object.freeze(['controller@clinic.local', 'strategy@clinic.local']),
  }),
});
