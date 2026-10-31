-- Precision medicine workspace: governed multi-omics summaries, specimen journey,
-- and structured genomics report readiness. All seeded records are synthetic.

IF OBJECT_ID('dbo.MolecularOmicsSummaries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MolecularOmicsSummaries (
        OmicsSummaryID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MolecularProfileID UNIQUEIDENTIFIER NOT NULL,
        SyntheticKey NVARCHAR(150) NULL,
        OmicsLayer NVARCHAR(30) NOT NULL,
        FeatureClass NVARCHAR(60) NOT NULL,
        FeatureCount INT NOT NULL,
        NormalizationMethod NVARCHAR(60) NOT NULL,
        QcStatus NVARCHAR(20) NOT NULL,
        DataUseScope NVARCHAR(30) NOT NULL,
        GeneratedAt DATETIME2 NOT NULL CONSTRAINT DF_MolecularOmicsSummaries_GeneratedAt DEFAULT SYSUTCDATETIME(),
        IsSynthetic BIT NOT NULL CONSTRAINT DF_MolecularOmicsSummaries_IsSynthetic DEFAULT 1,
        CONSTRAINT FK_MolecularOmicsSummaries_Profile
            FOREIGN KEY (MolecularProfileID) REFERENCES dbo.MolecularProfileRegistry(MolecularProfileID),
        CONSTRAINT CK_MolecularOmicsSummaries_Layer CHECK
            (OmicsLayer IN ('genomics', 'epigenomics', 'transcriptomics', 'proteomics', 'metabolomics')),
        CONSTRAINT CK_MolecularOmicsSummaries_FeatureCount CHECK (FeatureCount >= 0),
        CONSTRAINT CK_MolecularOmicsSummaries_QcStatus CHECK
            (QcStatus IN ('passed', 'review', 'failed')),
        CONSTRAINT CK_MolecularOmicsSummaries_DataUseScope CHECK
            (DataUseScope IN ('care', 'research', 'aggregate-only'))
    );
    CREATE UNIQUE INDEX UX_MolecularOmicsSummaries_SyntheticKey
        ON dbo.MolecularOmicsSummaries(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
    CREATE INDEX IX_MolecularOmicsSummaries_ProfileLayer
        ON dbo.MolecularOmicsSummaries(MolecularProfileID, OmicsLayer)
        INCLUDE (FeatureCount, QcStatus, DataUseScope);
    CREATE INDEX IX_MolecularOmicsSummaries_LayerQc
        ON dbo.MolecularOmicsSummaries(OmicsLayer, QcStatus)
        INCLUDE (FeatureCount);
END;
GO

IF OBJECT_ID('dbo.SpecimenJourneyEvents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SpecimenJourneyEvents (
        SpecimenEventID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MolecularProfileID UNIQUEIDENTIFIER NOT NULL,
        SyntheticKey NVARCHAR(160) NULL,
        JourneyStage NVARCHAR(30) NOT NULL,
        EventAt DATETIME2 NOT NULL,
        LabUnit NVARCHAR(80) NOT NULL,
        QcStatus NVARCHAR(20) NOT NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        IsSynthetic BIT NOT NULL CONSTRAINT DF_SpecimenJourneyEvents_IsSynthetic DEFAULT 1,
        CONSTRAINT FK_SpecimenJourneyEvents_Profile
            FOREIGN KEY (MolecularProfileID) REFERENCES dbo.MolecularProfileRegistry(MolecularProfileID),
        CONSTRAINT CK_SpecimenJourneyEvents_Stage CHECK
            (JourneyStage IN ('collected', 'accessioned', 'extracted', 'quality-control', 'analysed', 'reported')),
        CONSTRAINT CK_SpecimenJourneyEvents_QcStatus CHECK
            (QcStatus IN ('not-applicable', 'passed', 'review', 'failed')),
        CONSTRAINT CK_SpecimenJourneyEvents_Metadata CHECK
            (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
    );
    CREATE UNIQUE INDEX UX_SpecimenJourneyEvents_SyntheticKey
        ON dbo.SpecimenJourneyEvents(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
    CREATE INDEX IX_SpecimenJourneyEvents_ProfileTime
        ON dbo.SpecimenJourneyEvents(MolecularProfileID, EventAt)
        INCLUDE (JourneyStage, QcStatus, LabUnit);
    CREATE INDEX IX_SpecimenJourneyEvents_StageTime
        ON dbo.SpecimenJourneyEvents(JourneyStage, EventAt DESC)
        INCLUDE (QcStatus);
END;
GO

IF OBJECT_ID('dbo.StructuredGenomicReports', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.StructuredGenomicReports (
        StructuredReportID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MolecularProfileID UNIQUEIDENTIFIER NOT NULL,
        SyntheticKey NVARCHAR(150) NULL,
        StandardProfile NVARCHAR(180) NOT NULL,
        ReportStatus NVARCHAR(20) NOT NULL,
        CompletenessScore DECIMAL(5,2) NOT NULL,
        FindingCount INT NOT NULL,
        InterpretationCount INT NOT NULL,
        IssuedAt DATETIME2 NOT NULL,
        IsSynthetic BIT NOT NULL CONSTRAINT DF_StructuredGenomicReports_IsSynthetic DEFAULT 1,
        CONSTRAINT FK_StructuredGenomicReports_Profile
            FOREIGN KEY (MolecularProfileID) REFERENCES dbo.MolecularProfileRegistry(MolecularProfileID),
        CONSTRAINT CK_StructuredGenomicReports_Status CHECK
            (ReportStatus IN ('draft', 'final', 'amended')),
        CONSTRAINT CK_StructuredGenomicReports_Completeness CHECK
            (CompletenessScore >= 0 AND CompletenessScore <= 100),
        CONSTRAINT CK_StructuredGenomicReports_Counts CHECK
            (FindingCount >= 0 AND InterpretationCount >= 0)
    );
    CREATE UNIQUE INDEX UX_StructuredGenomicReports_SyntheticKey
        ON dbo.StructuredGenomicReports(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
    CREATE INDEX IX_StructuredGenomicReports_ProfileIssued
        ON dbo.StructuredGenomicReports(MolecularProfileID, IssuedAt DESC)
        INCLUDE (ReportStatus, CompletenessScore, FindingCount);
END;
GO

;WITH Profiles AS (
    SELECT MolecularProfileID, SyntheticKey, CollectedAt,
           ROW_NUMBER() OVER (ORDER BY SyntheticKey, MolecularProfileID) AS ProfileNumber
    FROM dbo.MolecularProfileRegistry
    WHERE SyntheticKey LIKE 'SYN-MOL-%'
), Layers AS (
    SELECT * FROM (VALUES
        (1, 'genomics', 'DNA variants', 'depth-and-callability', 1),
        (2, 'epigenomics', 'Methylation regions', 'beta-value-normalisation', 2),
        (3, 'transcriptomics', 'RNA expression', 'transcripts-per-million', 3),
        (4, 'proteomics', 'Protein abundance', 'median-ratio', 4),
        (5, 'metabolomics', 'Metabolite features', 'internal-standard', 5)
    ) v(LayerNumber, OmicsLayer, FeatureClass, NormalizationMethod, InclusionDivisor)
)
INSERT INTO dbo.MolecularOmicsSummaries (
    MolecularProfileID, SyntheticKey, OmicsLayer, FeatureClass, FeatureCount,
    NormalizationMethod, QcStatus, DataUseScope, GeneratedAt, IsSynthetic
)
SELECT p.MolecularProfileID, CONCAT(p.SyntheticKey, '-OMICS-', l.LayerNumber),
       l.OmicsLayer, l.FeatureClass,
       80 + ((p.ProfileNumber * 97 + l.LayerNumber * 211) % 4200),
       l.NormalizationMethod,
       CASE WHEN (p.ProfileNumber + l.LayerNumber) % 17 = 0 THEN 'review' ELSE 'passed' END,
       CASE WHEN l.OmicsLayer IN ('genomics', 'epigenomics') THEN 'aggregate-only' ELSE 'research' END,
       DATEADD(HOUR, 14 + l.LayerNumber * 3, p.CollectedAt), 1
FROM Profiles p
CROSS JOIN Layers l
WHERE (l.InclusionDivisor = 1 OR p.ProfileNumber % l.InclusionDivisor = 0)
  AND NOT EXISTS (
      SELECT 1 FROM dbo.MolecularOmicsSummaries existing
      WHERE existing.SyntheticKey = CONCAT(p.SyntheticKey, '-OMICS-', l.LayerNumber)
  );
GO

;WITH Profiles AS (
    SELECT MolecularProfileID, SyntheticKey, CollectedAt,
           ROW_NUMBER() OVER (ORDER BY SyntheticKey, MolecularProfileID) AS ProfileNumber
    FROM dbo.MolecularProfileRegistry
    WHERE SyntheticKey LIKE 'SYN-MOL-%'
), Stages AS (
    SELECT * FROM (VALUES
        (1, 'collected', 0, 'Collection point'),
        (2, 'accessioned', 2, 'Specimen accessioning'),
        (3, 'extracted', 7, 'Molecular laboratory'),
        (4, 'quality-control', 11, 'Quality control'),
        (5, 'analysed', 24, 'Bioinformatics core'),
        (6, 'reported', 36, 'Clinical reporting')
    ) v(StageNumber, JourneyStage, HourOffset, LabUnit)
)
INSERT INTO dbo.SpecimenJourneyEvents (
    MolecularProfileID, SyntheticKey, JourneyStage, EventAt, LabUnit, QcStatus, MetadataJson, IsSynthetic
)
SELECT p.MolecularProfileID, CONCAT(p.SyntheticKey, '-JOURNEY-', s.StageNumber),
       s.JourneyStage, DATEADD(HOUR, s.HourOffset + (p.ProfileNumber % 4), p.CollectedAt),
       s.LabUnit,
       CASE WHEN s.JourneyStage = 'quality-control' AND p.ProfileNumber % 19 = 0 THEN 'review'
            WHEN s.JourneyStage IN ('quality-control', 'analysed', 'reported') THEN 'passed'
            ELSE 'not-applicable' END,
       CONCAT('{"stageSequence":', s.StageNumber, ',"privacyClass":"derived-metadata"}'), 1
FROM Profiles p CROSS JOIN Stages s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SpecimenJourneyEvents existing
    WHERE existing.SyntheticKey = CONCAT(p.SyntheticKey, '-JOURNEY-', s.StageNumber)
);
GO

;WITH Profiles AS (
    SELECT mp.MolecularProfileID, mp.SyntheticKey, mp.IngestedAt,
           ROW_NUMBER() OVER (ORDER BY mp.SyntheticKey, mp.MolecularProfileID) AS ProfileNumber,
           COUNT(vo.VariantObservationID) AS FindingCount
    FROM dbo.MolecularProfileRegistry mp
    LEFT JOIN dbo.GenomicVariantObservations vo ON vo.MolecularProfileID = mp.MolecularProfileID
    WHERE mp.SyntheticKey LIKE 'SYN-MOL-%'
    GROUP BY mp.MolecularProfileID, mp.SyntheticKey, mp.IngestedAt
)
INSERT INTO dbo.StructuredGenomicReports (
    MolecularProfileID, SyntheticKey, StandardProfile, ReportStatus,
    CompletenessScore, FindingCount, InterpretationCount, IssuedAt, IsSynthetic
)
SELECT p.MolecularProfileID, CONCAT(p.SyntheticKey, '-FHIR-RPT'),
       'HL7 FHIR R4 Genomics Reporting IG 3.0.0',
       CASE WHEN p.ProfileNumber % 13 = 0 THEN 'amended' ELSE 'final' END,
       CAST(88 + (p.ProfileNumber % 12) AS DECIMAL(5,2)),
       p.FindingCount,
       CASE WHEN p.FindingCount > 0 THEN 1 + (p.ProfileNumber % 3) ELSE 0 END,
       DATEADD(HOUR, 42 + (p.ProfileNumber % 5), p.IngestedAt), 1
FROM Profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.StructuredGenomicReports existing
    WHERE existing.SyntheticKey = CONCAT(p.SyntheticKey, '-FHIR-RPT')
);
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetBioinformaticsAtlas
    @ClinicID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(DISTINCT mp.MolecularProfileID) AS ProfileCount,
        COUNT(DISTINCT vo.VariantObservationID) AS VariantObservationCount,
        COUNT(DISTINCT vo.GeneSymbol) AS GeneCount,
        COUNT(DISTINCT mp.AssayType) AS AssayTypeCount,
        COUNT(DISTINCT CASE WHEN pc.ConsentType = 'genomics' AND pc.Status = 'granted' THEN pc.PatientID END) AS GenomicsConsentCount
    FROM dbo.MolecularProfileRegistry mp
    LEFT JOIN dbo.GenomicVariantObservations vo ON vo.MolecularProfileID = mp.MolecularProfileID
    LEFT JOIN dbo.PatientConsents pc ON pc.ConsentID = mp.ConsentID
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID);

    SELECT mp.AssayType AS Label, COUNT_BIG(*) AS Value
    FROM dbo.MolecularProfileRegistry mp
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    GROUP BY mp.AssayType ORDER BY Value DESC, Label;

    SELECT vo.ClinicalSignificance AS Label, COUNT_BIG(*) AS Value
    FROM dbo.GenomicVariantObservations vo
    JOIN dbo.MolecularProfileRegistry mp ON mp.MolecularProfileID = vo.MolecularProfileID
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    GROUP BY vo.ClinicalSignificance ORDER BY Value DESC, Label;

    SELECT TOP (12) vo.GeneSymbol, COUNT_BIG(*) AS ObservationCount,
           CAST(AVG(CAST(vo.AlleleFraction AS DECIMAL(10,5))) AS DECIMAL(10,3)) AS AverageAlleleFraction,
           SUM(CASE WHEN vo.ClinicalSignificance IN ('pathogenic', 'likely-pathogenic') THEN 1 ELSE 0 END) AS CuratedSignalCount
    FROM dbo.GenomicVariantObservations vo
    JOIN dbo.MolecularProfileRegistry mp ON mp.MolecularProfileID = vo.MolecularProfileID
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    GROUP BY vo.GeneSymbol ORDER BY ObservationCount DESC, vo.GeneSymbol;

    SELECT mp.GenomeBuild AS Label, COUNT_BIG(*) AS Value
    FROM dbo.MolecularProfileRegistry mp
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    GROUP BY mp.GenomeBuild ORDER BY Label;

    SELECT TOP (8) mp.SyntheticKey, mp.AssayType, mp.GenomeBuild, mp.SpecimenType,
           mp.VariantCount, mp.InterpretationStatus, mp.CollectedAt, mp.IngestedAt
    FROM dbo.MolecularProfileRegistry mp
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    ORDER BY mp.CollectedAt DESC, mp.SyntheticKey;

    SELECT TOP (8) r.AnalysisRunID, r.AnalysisType, r.DatasetVersion, r.PipelineVersion,
           r.Status, r.StartedAt, r.CompletedAt, r.InputChecksum, r.IsSynthetic
    FROM dbo.BioinformaticsAnalysisRuns r
    WHERE (@ClinicID IS NULL OR r.ClinicID = @ClinicID)
    ORDER BY r.StartedAt DESC, r.AnalysisRunID DESC;

    SELECT os.OmicsLayer AS Label, COUNT_BIG(DISTINCT os.MolecularProfileID) AS Value,
           SUM(os.FeatureCount) AS FeatureCount,
           SUM(CASE WHEN os.QcStatus = 'passed' THEN 1 ELSE 0 END) AS PassedCount
    FROM dbo.MolecularOmicsSummaries os
    JOIN dbo.MolecularProfileRegistry mp ON mp.MolecularProfileID = os.MolecularProfileID
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    GROUP BY os.OmicsLayer ORDER BY Value DESC, Label;

    SELECT s.JourneyStage AS Label, COUNT_BIG(*) AS Value,
           SUM(CASE WHEN s.QcStatus IN ('passed', 'not-applicable') THEN 1 ELSE 0 END) AS HealthyCount,
           MIN(s.EventAt) AS FirstEventAt, MAX(s.EventAt) AS LastEventAt
    FROM dbo.SpecimenJourneyEvents s
    JOIN dbo.MolecularProfileRegistry mp ON mp.MolecularProfileID = s.MolecularProfileID
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID)
    GROUP BY s.JourneyStage
    ORDER BY CASE s.JourneyStage WHEN 'collected' THEN 1 WHEN 'accessioned' THEN 2 WHEN 'extracted' THEN 3
             WHEN 'quality-control' THEN 4 WHEN 'analysed' THEN 5 ELSE 6 END;

    SELECT
        COUNT_BIG(DISTINCT r.StructuredReportID) AS StructuredReportCount,
        SUM(CASE WHEN r.CompletenessScore >= 90 AND r.ReportStatus IN ('final', 'amended') THEN 1 ELSE 0 END) AS FhirReadyReportCount,
        CAST(AVG(r.CompletenessScore) AS DECIMAL(5,2)) AS AverageCompletenessScore,
        COUNT_BIG(DISTINCT CASE WHEN consent.Status = 'granted' THEN mp.PatientID END) AS ConsentReadyPatients,
        COUNT_BIG(DISTINCT mp.PatientID) AS ProfilePatients,
        (SELECT COUNT_BIG(*) FROM (
            SELECT grouped.PatientID FROM dbo.MolecularProfileRegistry grouped
            WHERE (@ClinicID IS NULL OR grouped.ClinicID = @ClinicID)
            GROUP BY grouped.PatientID HAVING COUNT_BIG(*) > 1
        ) repeated) AS LongitudinalPatientCount,
        (SELECT COUNT_BIG(*) FROM dbo.SpecimenJourneyEvents se
            JOIN dbo.MolecularProfileRegistry scoped ON scoped.MolecularProfileID = se.MolecularProfileID
            WHERE (@ClinicID IS NULL OR scoped.ClinicID = @ClinicID)) AS SpecimenEventCount
    FROM dbo.StructuredGenomicReports r
    JOIN dbo.MolecularProfileRegistry mp ON mp.MolecularProfileID = r.MolecularProfileID
    LEFT JOIN dbo.PatientConsents consent ON consent.ConsentID = mp.ConsentID AND consent.ConsentType = 'genomics'
    WHERE (@ClinicID IS NULL OR mp.ClinicID = @ClinicID);
END;
GO
