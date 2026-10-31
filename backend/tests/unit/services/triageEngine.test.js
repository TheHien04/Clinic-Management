import { describe, expect, it } from 'vitest';
import { defaultTriagePolicy, scoreTriage } from '../../../src/services/triageEngine.js';

describe('triageEngine', () => {
  it('classifies combined respiratory and vital red flags as emergency', () => {
    const result = scoreTriage({
      symptoms: 'shortness of breath and crushing chest pain',
      vitals: { spo2: 86, heartRate: 142, systolic: 188 },
      age: 79,
    });

    expect(result.urgency).toBe('emergency');
    expect(result.riskScore).toBe(100);
    expect(result.redFlags.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps a stable outpatient presentation in the routine band', () => {
    const result = scoreTriage({
      symptoms: 'routine medication review',
      vitals: { spo2: 98, heartRate: 72, temperature: 36.8, systolic: 122 },
      age: 42,
    });

    expect(result).toMatchObject({ riskScore: 0, urgency: 'routine', redFlags: [] });
  });

  it('honours a governed policy supplied by the caller', () => {
    const policy = {
      ...defaultTriagePolicy,
      symptomWeights: { ...defaultTriagePolicy.symptomWeights, chestPain: 10 },
      urgencyThresholds: { emergency: 80, urgent: 5 },
    };

    expect(scoreTriage({ symptoms: 'chest pain', policy }).urgency).toBe('urgent');
  });
});
