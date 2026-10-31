-- Bioinformatics Atlas: consent-scoped, synthetic molecular evidence for teaching and demos.
-- This migration stores derived metadata only. It contains no raw reads, VCF payloads, or real PHI.

IF OBJECT_ID('dbo.GenomicVariantObservations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GenomicVariantObservations (
        VariantObservationID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MolecularProfileID UNIQUEIDENTIFIER NOT NULL,
        SyntheticKey NVARCHAR(140) NULL,
        GeneSymbol NVARCHAR(30) NOT NULL,
        HgvsCoding NVARCHAR(120) NULL,
        HgvsProtein NVARCHAR(120) NULL,
        Consequence NVARCHAR(80) NOT NULL,
        ClinicalSignificance NVARCHAR(40) NOT NULL,
        AlleleFraction DECIMAL(6,5) NULL,
        EvidenceLevel NVARCHAR(30) NOT NULL,
        IsSynthetic BIT NOT NULL CONSTRAINT DF_GenomicVariantObservations_IsSynthetic DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_GenomicVariantObservations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_GenomicVariantObservations_Profile
            FOREIGN KEY (MolecularProfileID) REFERENCES dbo.MolecularProfileRegistry(MolecularProfileID),
        CONSTRAINT CK_GenomicVariantObservations_Significance CHECK
            (ClinicalSignificance IN ('pathogenic', 'likely-pathogenic', 'vus', 'likely-benign', 'benign')),
        CONSTRAINT CK_GenomicVariantObservations_AlleleFraction CHECK
            (AlleleFraction IS NULL OR (AlleleFraction >= 0 AND AlleleFraction <= 1)),
        CONSTRAINT CK_GenomicVariantObservations_Evidence CHECK
            (EvidenceLevel IN ('curated-demo', 'research-only'))
    );
    CREATE UNIQUE INDEX UX_GenomicVariantObservations_SyntheticKey
        ON dbo.GenomicVariantObservations(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
    CREATE INDEX IX_GenomicVariantObservations_ProfileGene
        ON dbo.GenomicVariantObservations(MolecularProfileID, GeneSymbol);
    CREATE INDEX IX_GenomicVariantObservations_GeneSignificance
        ON dbo.GenomicVariantObservations(GeneSymbol, ClinicalSignificance)
        INCLUDE (AlleleFraction, EvidenceLevel);
END;
GO

IF OBJECT_ID('dbo.BioinformaticsAnalysisRuns', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BioinformaticsAnalysisRuns (
        AnalysisRunID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClinicID INT NOT NULL,
        SyntheticKey NVARCHAR(120) NULL,
        AnalysisType NVARCHAR(60) NOT NULL,
        DatasetVersion NVARCHAR(80) NOT NULL,
        PipelineVersion NVARCHAR(40) NOT NULL,
        Status NVARCHAR(20) NOT NULL,
        ParametersJson NVARCHAR(MAX) NOT NULL,
        InputChecksum CHAR(64) NOT NULL,
        StartedAt DATETIME2 NOT NULL,
        CompletedAt DATETIME2 NULL,
        IsSynthetic BIT NOT NULL CONSTRAINT DF_BioinformaticsAnalysisRuns_IsSynthetic DEFAULT 1,
        CONSTRAINT FK_BioinformaticsAnalysisRuns_Clinic FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID),
        CONSTRAINT CK_BioinformaticsAnalysisRuns_Type CHECK
            (AnalysisType IN ('cohort-qc', 'variant-summary', 'assay-composition', 'genome-build-audit')),
        CONSTRAINT CK_BioinformaticsAnalysisRuns_Status CHECK
            (Status IN ('queued', 'running', 'completed', 'failed')),
        CONSTRAINT CK_BioinformaticsAnalysisRuns_Parameters CHECK (ISJSON(ParametersJson) = 1),
        CONSTRAINT CK_BioinformaticsAnalysisRuns_Times CHECK
            (CompletedAt IS NULL OR CompletedAt >= StartedAt)
    );
    CREATE UNIQUE INDEX UX_BioinformaticsAnalysisRuns_SyntheticKey
        ON dbo.BioinformaticsAnalysisRuns(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
    CREATE INDEX IX_BioinformaticsAnalysisRuns_ClinicStarted
        ON dbo.BioinformaticsAnalysisRuns(ClinicID, StartedAt DESC)
        INCLUDE (AnalysisType, Status, DatasetVersion, PipelineVersion);
END;
GO

;WITH Profiles AS (
    SELECT MolecularProfileID, SyntheticKey,
           ROW_NUMBER() OVER (ORDER BY SyntheticKey, MolecularProfileID) AS ProfileNumber
    FROM dbo.MolecularProfileRegistry
    WHERE SyntheticKey LIKE 'SYN-MOL-%'
), Slots AS (
    SELECT SlotNumber FROM (VALUES (1), (2), (3), (4), (5), (6)) v(SlotNumber)
), Seed AS (
    SELECT p.MolecularProfileID, p.SyntheticKey, p.ProfileNumber, s.SlotNumber,
           ((p.ProfileNumber * 3 + s.SlotNumber - 1) % 12) AS GeneIndex,
           ((p.ProfileNumber * 7 + s.SlotNumber * 11) % 100) AS SignificanceIndex
    FROM Profiles p CROSS JOIN Slots s
)
INSERT INTO dbo.GenomicVariantObservations (
    MolecularProfileID, SyntheticKey, GeneSymbol, HgvsCoding, HgvsProtein,
    Consequence, ClinicalSignificance, AlleleFraction, EvidenceLevel, IsSynthetic
)
SELECT
    seed.MolecularProfileID,
    CONCAT(seed.SyntheticKey, '-VAR-', RIGHT(CONCAT('00', seed.SlotNumber), 2)),
    genes.GeneSymbol,
    CONCAT('c.', 100 + seed.ProfileNumber * 13 + seed.SlotNumber * 17, genes.CodingChange),
    CONCAT('p.', genes.ProteinPrefix, 20 + seed.ProfileNumber + seed.SlotNumber, genes.ProteinSuffix),
    CASE seed.SlotNumber % 4 WHEN 0 THEN 'frameshift' WHEN 1 THEN 'missense' WHEN 2 THEN 'splice-region' ELSE 'synonymous' END,
    CASE WHEN seed.SignificanceIndex < 12 THEN 'pathogenic'
         WHEN seed.SignificanceIndex < 28 THEN 'likely-pathogenic'
         WHEN seed.SignificanceIndex < 66 THEN 'vus'
         WHEN seed.SignificanceIndex < 84 THEN 'likely-benign'
         ELSE 'benign' END,
    CAST((8 + ((seed.ProfileNumber * 19 + seed.SlotNumber * 23) % 83)) / 100.0 AS DECIMAL(6,5)),
    CASE WHEN seed.SignificanceIndex < 28 THEN 'curated-demo' ELSE 'research-only' END,
    1
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

;WITH Clinics AS (
    SELECT ClinicID FROM dbo.Clinics
), Workflows AS (
    SELECT * FROM (VALUES
        (1, 'cohort-qc', '2.4.0', '{"minimumDepth":30,"missingnessThreshold":0.05}'),
        (2, 'variant-summary', '3.1.2', '{"classification":"five-tier","aggregateOnly":true}'),
        (3, 'assay-composition', '1.8.1', '{"groupBy":"assayType","privacy":"aggregate"}'),
        (4, 'genome-build-audit', '2.0.3', '{"acceptedBuilds":["GRCh37","GRCh38"]}')
    ) v(RunNumber, AnalysisType, PipelineVersion, ParametersJson)
)
INSERT INTO dbo.BioinformaticsAnalysisRuns (
    ClinicID, SyntheticKey, AnalysisType, DatasetVersion, PipelineVersion, Status,
    ParametersJson, InputChecksum, StartedAt, CompletedAt, IsSynthetic
)
SELECT c.ClinicID, CONCAT('SYN-BIO-RUN-', c.ClinicID, '-', w.RunNumber),
       w.AnalysisType, 'health-synthetic-v1', w.PipelineVersion, 'completed',
       w.ParametersJson,
       CONVERT(CHAR(64), HASHBYTES('SHA2_256', CONCAT('bioinformatics-run-', c.ClinicID, '-', w.RunNumber)), 2),
       DATEADD(DAY, -w.RunNumber * 2, SYSUTCDATETIME()),
       DATEADD(MINUTE, 5 + w.RunNumber * 3, DATEADD(DAY, -w.RunNumber * 2, SYSUTCDATETIME())), 1
FROM Clinics c CROSS JOIN Workflows w
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.BioinformaticsAnalysisRuns r
    WHERE r.SyntheticKey = CONCAT('SYN-BIO-RUN-', c.ClinicID, '-', w.RunNumber)
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
END;
GO
