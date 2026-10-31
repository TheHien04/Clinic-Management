import { describe, expect, it } from 'vitest';
import {
  buildCohortSeries,
  buildComparisonMetrics,
  buildDataQuality,
  buildMonthlySeries,
  buildPatientRiskTrajectory,
  buildPrecisionCareRows,
} from './reportAnalytics';

const rows = [
  { patient: 'P-1', doctor: 'Dr. A', service: 'Cardiology', date: '2026-01-02', status: 'completed', fee: 300000 },
  { patient: 'P-1', doctor: 'Dr. A', service: 'Cardiology', date: '2026-02-02', status: 'pending', fee: 300000 },
  { patient: 'P-2', doctor: 'Dr. B', service: 'General Medicine', date: '2026-02-03', status: 'cancelled', fee: 150000 },
];

describe('report analytics', () => {
  it('builds monthly and cohort series deterministically', () => {
    expect(buildMonthlySeries(rows)).toEqual([
      expect.objectContaining({ month: '2026-01', appointments: 1, completionRate: 100 }),
      expect.objectContaining({ month: '2026-02', appointments: 2, cancellationRate: 50 }),
    ]);
    expect(buildCohortSeries(rows)).toEqual([
      { month: '2026-01', newPatients: 1, returningPatients: 0, retentionRate: 0 },
      { month: '2026-02', newPatients: 1, returningPatients: 1, retentionRate: 50 },
    ]);
  });

  it('computes period comparison and data quality findings', () => {
    const comparison = buildComparisonMetrics({ appointments: rows, dateRange: { from: '2026-02-01', to: '2026-02-28' }, doctorFilter: '', serviceFilter: '', statusFilter: '' });
    expect(comparison.current.appointments).toBe(2);
    expect(comparison.previous.appointments).toBe(0);
    expect(buildDataQuality(rows).score).toBe(100);
  });

  it('builds risk trajectory and precision-care rows', () => {
    expect(buildPatientRiskTrajectory(rows)[1]).toEqual(expect.objectContaining({ month: '2026-02', high: 1, medium: 1 }));
    const precision = buildPrecisionCareRows(rows, new Date('2026-02-10T00:00:00Z'));
    expect(precision).toHaveLength(2);
    expect(precision[0]).toEqual(expect.objectContaining({ patient: 'P-1', riskBand: 'low' }));
  });
});
