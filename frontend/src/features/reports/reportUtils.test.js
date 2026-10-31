import { describe, expect, it } from 'vitest';
import {
  computeDeltaPercent,
  getPreviousWeekRange,
  inferPatientRiskBand,
  mapAppointmentStatusToFhir,
  validateDtxPolicyPayload,
} from './reportUtils';
import { DEFAULT_DTX_POLICY } from './reportConfig';

describe('reportUtils', () => {
  it('validates and normalizes a governed DTx policy', () => {
    expect(validateDtxPolicyPayload(DEFAULT_DTX_POLICY)).toEqual(DEFAULT_DTX_POLICY);
  });

  it('rejects policy weights that do not sum to one', () => {
    expect(() => validateDtxPolicyPayload({
      ...DEFAULT_DTX_POLICY,
      sessionWeights: { completion: 0.5, engagement: 0.5, riskInverse: 0.5 },
    })).toThrow('sessionWeights must sum to 1.0');
  });

  it('derives deterministic reporting classifications', () => {
    expect(inferPatientRiskBand({ status: 'cancelled', service: 'Cardiology', fee: 300000 })).toBe('high');
    expect(computeDeltaPercent(120, 100)).toBe(20);
    expect(mapAppointmentStatusToFhir('completed')).toBe('fulfilled');
  });

  it('calculates the previous Monday-to-Sunday range', () => {
    expect(getPreviousWeekRange(new Date('2026-10-21T12:00:00Z'))).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
    });
  });
});
