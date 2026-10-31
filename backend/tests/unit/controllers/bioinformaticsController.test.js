import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeQueryMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/config/database.js', () => ({
  executeQuery: executeQueryMock,
}));

import { getBioinformaticsAtlas } from '../../../src/controllers/bioinformaticsController.js';

const createRes = () => ({ json: vi.fn() });

describe('bioinformatics controller', () => {
  beforeEach(() => {
    executeQueryMock.mockReset();
  });

  it('maps governed precision-medicine SQL result sets into the atlas contract', async () => {
    executeQueryMock.mockResolvedValue({
      recordsets: [
        [{ ProfileCount: 40, VariantObservationCount: 240, GeneCount: 12, AssayTypeCount: 3, GenomicsConsentCount: 40 }],
        [{ Label: 'targeted-panel', Value: 20 }],
        [{ Label: 'vus', Value: 90 }],
        [{ GeneSymbol: 'TP53', ObservationCount: 20, AverageAlleleFraction: 0.42, CuratedSignalCount: 5 }],
        [{ Label: 'GRCh38', Value: 40 }],
        [],
        [{ AnalysisRunID: 1, AnalysisType: 'cohort-qc', DatasetVersion: 'health-synthetic-v1', PipelineVersion: '2.4.0', Status: 'completed', InputChecksum: 'abcdef1234567890', IsSynthetic: true }],
        [{ Label: 'genomics', Value: 40, FeatureCount: 42000, PassedCount: 38 }],
        [{ Label: 'collected', Value: 40, HealthyCount: 40 }],
        [{ StructuredReportCount: 40, FhirReadyReportCount: 35, AverageCompletenessScore: 94, ConsentReadyPatients: 40, ProfilePatients: 40, LongitudinalPatientCount: 8, SpecimenEventCount: 240 }],
      ],
    });

    const res = createRes();
    const next = vi.fn();
    await getBioinformaticsAtlas({ user: { clinicId: 1 } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(executeQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('sp_GetBioinformaticsAtlas'),
      { clinicId: 1 },
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.overview.multiOmicsLayers).toBe(1);
    expect(payload.data.multiOmicsComposition[0]).toMatchObject({ label: 'genomics', profiles: 40, features: 42000 });
    expect(payload.data.specimenJourney[0]).toMatchObject({ stage: 'collected', events: 40 });
    expect(payload.data.precisionReadiness).toMatchObject({ consentCoverage: 100, fhirReadyReports: 35, specimenEvents: 240 });
    expect(payload.data.provenance.interoperabilityProfile).toContain('HL7 FHIR R4');
  });
});
