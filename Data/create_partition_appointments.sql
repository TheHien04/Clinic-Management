-- =============================================================
-- PARTITIONING STRATEGY FOR APPOINTMENTS TABLE (Big Data)
-- Author: Clinic Management Team
-- Date: 2026-03-28
-- =============================================================
-- This script will partition the appointments table by year (AppointmentDate)
-- to optimize query performance for large datasets (CSDL nâng cao requirement)
-- =============================================================

USE ClinicDB;
GO

-- 1. Create partition function (by year)
IF NOT EXISTS (SELECT * FROM sys.partition_functions WHERE name = 'pf_AppointmentsByYear')
BEGIN
    CREATE PARTITION FUNCTION pf_AppointmentsByYear (DATETIME2)
    AS RANGE RIGHT FOR VALUES 
        ('2023-01-01', '2024-01-01', '2025-01-01', '2026-01-01', '2027-01-01');
    PRINT 'Created partition function pf_AppointmentsByYear';
END;
GO

-- 2. Create partition scheme
IF NOT EXISTS (SELECT * FROM sys.partition_schemes WHERE name = 'ps_AppointmentsByYear')
BEGIN
    CREATE PARTITION SCHEME ps_AppointmentsByYear
    AS PARTITION pf_AppointmentsByYear
    ALL TO ([PRIMARY]);
    PRINT 'Created partition scheme ps_AppointmentsByYear';
END;
GO

-- 3. (Optional) Recreate appointments table on partition scheme (if needed)
--    This step requires downtime and data migration for existing DBs.
--    For demo: create a new partitioned table, migrate data, then swap.

-- 4. Verify partitioning
SELECT * FROM sys.partition_schemes WHERE name = 'ps_AppointmentsByYear';
SELECT * FROM sys.partition_functions WHERE name = 'pf_AppointmentsByYear';

-- 5. (Optional) Add partitioned index
-- Example:
-- CREATE CLUSTERED INDEX idx_partitioned_appointments
-- ON appointments (AppointmentDate)
-- ON ps_AppointmentsByYear(AppointmentDate);

PRINT 'Partitioning script for appointments table completed.';
GO
