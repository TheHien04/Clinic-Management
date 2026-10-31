import { executeQuery } from '../config/database.js';

const numberValue = (value) => Number(value || 0);
const categoryRows = (rows = []) => rows.map((row) => ({
  label: row.Label,
  value: numberValue(row.Value),
}));

export const getBioinformaticsAtlas = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinicId || null;
    const result = await executeQuery(
      'EXEC dbo.sp_GetBioinformaticsAtlas @ClinicID = @clinicId;',
      { clinicId },
    );
    const sets = result.recordsets || [];
    const overviewRow = sets[0]?.[0] || {};
    const readinessRow = sets[9]?.[0] || {};
    const profilePatients = numberValue(readinessRow.ProfilePatients);
    const consentReadyPatients = numberValue(readinessRow.ConsentReadyPatients);

    res.json({
      success: true,
      data: {
        source: 'synthetic-sql',
        generatedAt: new Date().toISOString(),
        nonDiagnostic: true,
        overview: {
          profiles: numberValue(overviewRow.ProfileCount),
          variantObservations: numberValue(overviewRow.VariantObservationCount),
          genes: numberValue(overviewRow.GeneCount),
          assayTypes: numberValue(overviewRow.AssayTypeCount),
          genomicsConsents: numberValue(overviewRow.GenomicsConsentCount),
          multiOmicsLayers: (sets[7] || []).length,
          structuredReports: numberValue(readinessRow.StructuredReportCount),
          specimenEvents: numberValue(readinessRow.SpecimenEventCount),
        },
        assayComposition: categoryRows(sets[1]),
        evidenceDistribution: categoryRows(sets[2]),
        geneCatalog: (sets[3] || []).map((row) => ({
          gene: row.GeneSymbol,
          observations: numberValue(row.ObservationCount),
          averageAlleleFraction: numberValue(row.AverageAlleleFraction),
          curatedSignals: numberValue(row.CuratedSignalCount),
        })),
        genomeBuilds: categoryRows(sets[4]),
        recentProfiles: (sets[5] || []).map((row) => ({
          key: row.SyntheticKey,
          assayType: row.AssayType,
          genomeBuild: row.GenomeBuild,
          specimenType: row.SpecimenType,
          sourceVariantCount: numberValue(row.VariantCount),
          status: row.InterpretationStatus,
          collectedAt: row.CollectedAt,
          ingestedAt: row.IngestedAt,
        })),
        workflows: (sets[6] || []).map((row) => ({
          id: numberValue(row.AnalysisRunID),
          analysisType: row.AnalysisType,
          datasetVersion: row.DatasetVersion,
          pipelineVersion: row.PipelineVersion,
          status: row.Status,
          startedAt: row.StartedAt,
          completedAt: row.CompletedAt,
          checksumPrefix: String(row.InputChecksum || '').slice(0, 12),
          synthetic: Boolean(row.IsSynthetic),
        })),
        multiOmicsComposition: (sets[7] || []).map((row) => ({
          label: row.Label,
          profiles: numberValue(row.Value),
          features: numberValue(row.FeatureCount),
          qcPassed: numberValue(row.PassedCount),
        })),
        specimenJourney: (sets[8] || []).map((row) => ({
          stage: row.Label,
          events: numberValue(row.Value),
          healthyEvents: numberValue(row.HealthyCount),
          firstEventAt: row.FirstEventAt,
          lastEventAt: row.LastEventAt,
        })),
        precisionReadiness: {
          structuredReports: numberValue(readinessRow.StructuredReportCount),
          fhirReadyReports: numberValue(readinessRow.FhirReadyReportCount),
          averageCompleteness: numberValue(readinessRow.AverageCompletenessScore),
          consentReadyPatients,
          profilePatients,
          consentCoverage: profilePatients > 0
            ? Math.round((consentReadyPatients / profilePatients) * 100)
            : 0,
          longitudinalPatients: numberValue(readinessRow.LongitudinalPatientCount),
          specimenEvents: numberValue(readinessRow.SpecimenEventCount),
        },
        provenance: {
          datasetVersion: 'health-synthetic-v1',
          privacyClass: 'aggregate-and-derived-metadata',
          rawSequenceDataStored: false,
          intendedUse: 'education-and-product-demonstration',
          interoperabilityProfile: 'HL7 FHIR R4 Genomics Reporting IG 3.0.0',
          consentModel: 'append-only, purpose-scoped decisions',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export default { getBioinformaticsAtlas };
