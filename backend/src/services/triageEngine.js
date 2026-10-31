const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const defaultTriagePolicy = Object.freeze({
  symptomWeights: Object.freeze({ chestPain: 45, respiratoryDistress: 35, neurologicalEmergency: 45 }),
  vitalThresholds: Object.freeze({
    spo2Low: 92,
    heartRateHigh: 130,
    heartRateLow: 45,
    tempHigh: 39.5,
    systolicHigh: 180,
    systolicLow: 90,
  }),
  vitalWeights: Object.freeze({ spo2Low: 40, heartRateCritical: 30, tempHigh: 20, systolicCritical: 25 }),
  ageWeights: Object.freeze({ elderly: 10 }),
  urgencyThresholds: Object.freeze({ emergency: 70, urgent: 40 }),
});

export const scoreTriage = ({ symptoms = '', vitals = {}, age = 35, policy = defaultTriagePolicy }) => {
  const text = String(symptoms || '').toLowerCase();
  const heartRate = Number(vitals.heartRate || 0);
  const spo2 = Number(vitals.spo2 || 0);
  const temperature = Number(vitals.temperature || 0);
  const systolic = Number(vitals.systolic || 0);

  const redFlags = [];
  let score = 0;

  if (/chest pain|severe chest|crushing chest/.test(text)) {
    score += Number(policy.symptomWeights.chestPain || 0);
    redFlags.push('Possible acute coronary syndrome signal');
  }
  if (/shortness of breath|cannot breathe|breathless/.test(text)) {
    score += Number(policy.symptomWeights.respiratoryDistress || 0);
    redFlags.push('Respiratory distress symptom pattern');
  }
  if (/confusion|faint|seizure|stroke/.test(text)) {
    score += Number(policy.symptomWeights.neurologicalEmergency || 0);
    redFlags.push('Neurological emergency symptom pattern');
  }
  if (spo2 > 0 && spo2 < Number(policy.vitalThresholds.spo2Low || 0)) {
    score += Number(policy.vitalWeights.spo2Low || 0);
    redFlags.push('Low oxygen saturation (<92%)');
  }
  if (heartRate > Number(policy.vitalThresholds.heartRateHigh || 0)
      || heartRate < Number(policy.vitalThresholds.heartRateLow || 0)) {
    score += Number(policy.vitalWeights.heartRateCritical || 0);
    redFlags.push('Heart rate outside safe range');
  }
  if (temperature >= Number(policy.vitalThresholds.tempHigh || 0)) {
    score += Number(policy.vitalWeights.tempHigh || 0);
    redFlags.push('High fever (>=39.5C)');
  }
  if (systolic > Number(policy.vitalThresholds.systolicHigh || 0)
      || (systolic > 0 && systolic < Number(policy.vitalThresholds.systolicLow || 0))) {
    score += Number(policy.vitalWeights.systolicCritical || 0);
    redFlags.push('Abnormal blood pressure threshold');
  }
  if (age >= 75) score += Number(policy.ageWeights.elderly || 0);

  const riskScore = clamp(Math.round(score), 0, 100);
  const emergencyThreshold = Number(policy.urgencyThresholds.emergency || 70);
  const urgentThreshold = Number(policy.urgencyThresholds.urgent || 40);
  const urgency = riskScore >= emergencyThreshold ? 'emergency' : riskScore >= urgentThreshold ? 'urgent' : 'routine';
  const recommendation = urgency === 'emergency'
    ? 'Escalate to emergency care immediately and trigger clinician callback now.'
    : urgency === 'urgent'
      ? 'Schedule same-day clinical assessment with vitals re-check and follow-up call.'
      : 'Proceed with standard outpatient workflow and proactive preventive follow-up.';

  return { riskScore, urgency, redFlags, recommendation };
};
