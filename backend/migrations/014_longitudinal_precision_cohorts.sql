-- Longitudinal synthetic cohort: repeat molecular profiles for follow-up analysis.
-- Keeps the original consent link and stores derived metadata only.

;WITH EligibleProfiles AS (
    SELECT TOP (10)
        mp.MolecularProfileID AS SourceProfileID,
        mp.SyntheticKey AS SourceSyntheticKey,
        mp.PatientID,
        mp.ClinicID,
        mp.ConsentID,
        mp.CollectedAt,
        ROW_NUMBER() OVER (ORDER BY mp.SyntheticKey) AS FollowUpNumber
    FROM dbo.MolecularProfileRegistry mp
    WHERE mp.SyntheticKey LIKE 'SYN-MOL-[0-9][0-9][0-9]'
      AND mp.CollectedAt <= DATEADD(DAY, -21, SYSUTCDATETIME())
    ORDER BY mp.SyntheticKey
)
INSERT INTO dbo.MolecularProfileRegistry (
    SyntheticKey, PatientID, ClinicID, ConsentID, AssayType, GenomeBuild,
    SpecimenType, SourceFormat, ChecksumSha256, VariantCount,
    InterpretationStatus, CollectedAt
)
SELECT CONCAT(e.SourceSyntheticKey, '-FOLLOWUP-02'), e.PatientID, e.ClinicID, e.ConsentID,
       CASE e.FollowUpNumber % 3 WHEN 0 THEN 'ctDNA longitudinal panel'
            WHEN 1 THEN 'Targeted cancer panel' ELSE 'Whole exome sequencing' END,
       'GRCh38',
       CASE e.FollowUpNumber % 2 WHEN 0 THEN 'Plasma' ELSE 'Whole blood' END,
       'VCF',
       CONVERT(CHAR(64), HASHBYTES('SHA2_256', CONCAT('longitudinal-followup-', e.SourceSyntheticKey)), 2),
       120 + ((e.FollowUpNumber * 313) % 1800),
       CASE e.FollowUpNumber % 3 WHEN 0 THEN 'reviewed' WHEN 1 THEN 'interpreted' ELSE 'quality-checked' END,
       DATEADD(DAY, 21, e.CollectedAt)
FROM EligibleProfiles e
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.MolecularProfileRegistry existing
    WHERE existing.SyntheticKey = CONCAT(e.SourceSyntheticKey, '-FOLLOWUP-02')
);
GO

;WITH Profiles AS (
    SELECT MolecularProfileID, SyntheticKey,
           ROW_NUMBER() OVER (ORDER BY SyntheticKey) AS ProfileNumber
    FROM dbo.MolecularProfileRegistry
    WHERE SyntheticKey LIKE 'SYN-MOL-%-FOLLOWUP-02'
), Slots AS (
    SELECT SlotNumber FROM (VALUES (1), (2), (3), (4), (5), (6)) v(SlotNumber)
), Seed AS (
    SELECT p.MolecularProfileID, p.SyntheticKey, p.ProfileNumber, s.SlotNumber,
           ((p.ProfileNumber * 5 + s.SlotNumber - 1) % 12) AS GeneIndex
    FROM Profiles p CROSS JOIN Slots s
)
INSERT INTO dbo.GenomicVariantObservations (
    MolecularProfileID, SyntheticKey, GeneSymbol, HgvsCoding, HgvsProtein,
    Consequence, ClinicalSignificance, AlleleFraction, EvidenceLevel, IsSynthetic
)
SELECT seed.MolecularProfileID,
       CONCAT(seed.SyntheticKey, '-VAR-', RIGHT(CONCAT('00', seed.SlotNumber), 2)),
       genes.GeneSymbol,
       CONCAT('c.', 700 + seed.ProfileNumber * 31 + seed.SlotNumber * 13, genes.CodingChange),
       CONCAT('p.', genes.ProteinPrefix, 40 + seed.ProfileNumber + seed.SlotNumber, genes.ProteinSuffix),
       CASE seed.SlotNumber % 4 WHEN 0 THEN 'frameshift' WHEN 1 THEN 'missense' WHEN 2 THEN 'splice-region' ELSE 'synonymous' END,
       CASE seed.SlotNumber % 5 WHEN 0 THEN 'pathogenic' WHEN 1 THEN 'likely-pathogenic'
            WHEN 2 THEN 'vus' WHEN 3 THEN 'likely-benign' ELSE 'benign' END,
       CAST((12 + ((seed.ProfileNumber * 17 + seed.SlotNumber * 19) % 72)) / 100.0 AS DECIMAL(6,5)),
       CASE WHEN seed.SlotNumber % 5 IN (0, 1) THEN 'curated-demo' ELSE 'research-only' END, 1
FROM Seed seed
JOIN (VALUES
    (0, 'TP53', 'A>G', 'Arg', 'Gly'), (1, 'BRCA1', 'C>T', 'Ser', 'Leu'),
    (2, 'BRCA2', 'G>A', 'Val', 'Ile'), (3, 'EGFR', 'T>C', 'Leu', 'Pro'),
    (4, 'KRAS', 'G>T', 'Gly', 'Val'), (5, 'PIK3CA', 'A>C', 'Glu', 'Ala'),
    (6, 'APOE', 'C>T', 'Cys', 'Arg'), (7, 'CYP2C19', 'G>A', 'Gly', 'Asp'),
    (8, 'CYP2D6', 'T>C', 'Phe', 'Ser'), (9, 'SLCO1B1', 'A>G', 'Asn', 'Ser'),
    (10, 'BRAF', 'T>A', 'Val', 'Glu'), (11, 'ALK', 'C>G', 'Pro', 'Arg')
) genes(GeneIndex, GeneSymbol, CodingChange, ProteinPrefix, ProteinSuffix)
    ON genes.GeneIndex = seed.GeneIndex
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.GenomicVariantObservations existing
    WHERE existing.SyntheticKey = CONCAT(seed.SyntheticKey, '-VAR-', RIGHT(CONCAT('00', seed.SlotNumber), 2))
);
GO

;WITH Profiles AS (
    SELECT MolecularProfileID, SyntheticKey, CollectedAt,
           ROW_NUMBER() OVER (ORDER BY SyntheticKey) AS ProfileNumber
    FROM dbo.MolecularProfileRegistry
    WHERE SyntheticKey LIKE 'SYN-MOL-%-FOLLOWUP-02'
), Layers AS (
    SELECT * FROM (VALUES
        (1, 'genomics', 'DNA variants', 'depth-and-callability'),
        (2, 'epigenomics', 'Methylation regions', 'beta-value-normalisation'),
        (3, 'proteomics', 'Protein abundance', 'median-ratio')
    ) v(LayerNumber, OmicsLayer, FeatureClass, NormalizationMethod)
)
INSERT INTO dbo.MolecularOmicsSummaries (
    MolecularProfileID, SyntheticKey, OmicsLayer, FeatureClass, FeatureCount,
    NormalizationMethod, QcStatus, DataUseScope, GeneratedAt, IsSynthetic
)
SELECT p.MolecularProfileID, CONCAT(p.SyntheticKey, '-OMICS-', l.LayerNumber),
       l.OmicsLayer, l.FeatureClass, 200 + ((p.ProfileNumber * 149 + l.LayerNumber * 83) % 2500),
       l.NormalizationMethod,
       CASE WHEN (p.ProfileNumber + l.LayerNumber) % 13 = 0 THEN 'review' ELSE 'passed' END,
       'aggregate-only', DATEADD(HOUR, 12 + l.LayerNumber * 4, p.CollectedAt), 1
FROM Profiles p CROSS JOIN Layers l
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.MolecularOmicsSummaries existing
    WHERE existing.SyntheticKey = CONCAT(p.SyntheticKey, '-OMICS-', l.LayerNumber)
);
GO

;WITH Profiles AS (
    SELECT MolecularProfileID, SyntheticKey, CollectedAt,
           ROW_NUMBER() OVER (ORDER BY SyntheticKey) AS ProfileNumber
    FROM dbo.MolecularProfileRegistry
    WHERE SyntheticKey LIKE 'SYN-MOL-%-FOLLOWUP-02'
), Stages AS (
    SELECT * FROM (VALUES
        (1, 'collected', 0, 'Collection point'), (2, 'accessioned', 2, 'Specimen accessioning'),
        (3, 'extracted', 6, 'Molecular laboratory'), (4, 'quality-control', 10, 'Quality control'),
        (5, 'analysed', 22, 'Bioinformatics core'), (6, 'reported', 34, 'Clinical reporting')
    ) v(StageNumber, JourneyStage, HourOffset, LabUnit)
)
INSERT INTO dbo.SpecimenJourneyEvents (
    MolecularProfileID, SyntheticKey, JourneyStage, EventAt, LabUnit, QcStatus, MetadataJson, IsSynthetic
)
SELECT p.MolecularProfileID, CONCAT(p.SyntheticKey, '-JOURNEY-', s.StageNumber),
       s.JourneyStage, DATEADD(HOUR, s.HourOffset, p.CollectedAt), s.LabUnit,
       CASE WHEN s.JourneyStage IN ('quality-control', 'analysed', 'reported') THEN 'passed' ELSE 'not-applicable' END,
       CONCAT('{"stageSequence":', s.StageNumber, ',"episode":"longitudinal-followup"}'), 1
FROM Profiles p CROSS JOIN Stages s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SpecimenJourneyEvents existing
    WHERE existing.SyntheticKey = CONCAT(p.SyntheticKey, '-JOURNEY-', s.StageNumber)
);
GO

;WITH Profiles AS (
    SELECT mp.MolecularProfileID, mp.SyntheticKey, mp.IngestedAt,
           ROW_NUMBER() OVER (ORDER BY mp.SyntheticKey) AS ProfileNumber,
           COUNT(vo.VariantObservationID) AS FindingCount
    FROM dbo.MolecularProfileRegistry mp
    LEFT JOIN dbo.GenomicVariantObservations vo ON vo.MolecularProfileID = mp.MolecularProfileID
    WHERE mp.SyntheticKey LIKE 'SYN-MOL-%-FOLLOWUP-02'
    GROUP BY mp.MolecularProfileID, mp.SyntheticKey, mp.IngestedAt
)
INSERT INTO dbo.StructuredGenomicReports (
    MolecularProfileID, SyntheticKey, StandardProfile, ReportStatus,
    CompletenessScore, FindingCount, InterpretationCount, IssuedAt, IsSynthetic
)
SELECT p.MolecularProfileID, CONCAT(p.SyntheticKey, '-FHIR-RPT'),
       'HL7 FHIR R4 Genomics Reporting IG 3.0.0', 'final',
       CAST(92 + (p.ProfileNumber % 8) AS DECIMAL(5,2)), p.FindingCount,
       1 + (p.ProfileNumber % 3), DATEADD(HOUR, 40, p.IngestedAt), 1
FROM Profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.StructuredGenomicReports existing
    WHERE existing.SyntheticKey = CONCAT(p.SyntheticKey, '-FHIR-RPT')
);
GO
