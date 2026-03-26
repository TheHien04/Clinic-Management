-- ======================================================
-- AUDIT TRAIL SYSTEM FOR CLINIC MANAGEMENT
-- Track all data changes for compliance & security
-- ======================================================
-- Chạy file này SAU KHI đã tạo tất cả tables
-- ======================================================

USE ClinicDB;
GO

PRINT '🚀 Bắt đầu tạo audit trail system...';
GO

-- ============================================
-- 1. CREATE AUDIT LOG TABLE
-- ============================================

IF OBJECT_ID('audit_log', 'U') IS NOT NULL
    DROP TABLE audit_log;
GO

CREATE TABLE audit_log (
    audit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    table_name NVARCHAR(100) NOT NULL,
    operation_type CHAR(1) NOT NULL CHECK (operation_type IN ('I', 'U', 'D')), -- Insert, Update, Delete
    record_id INT NOT NULL,
    old_value NVARCHAR(MAX),
    new_value NVARCHAR(MAX),
    changed_by NVARCHAR(255) DEFAULT SYSTEM_USER,
    changed_at DATETIME2 DEFAULT GETDATE(),
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500)
);
GO

PRINT '✅ Created audit_log table';
GO

-- Index for faster queries
CREATE NONCLUSTERED INDEX idx_audit_log_table_record 
ON audit_log(table_name, record_id, changed_at DESC);

CREATE NONCLUSTERED INDEX idx_audit_log_user 
ON audit_log(changed_by, changed_at DESC);

CREATE NONCLUSTERED INDEX idx_audit_log_changed_at 
ON audit_log(changed_at DESC);

PRINT '✅ Created indexes on audit_log';
GO

-- ============================================
-- 2. AUDIT TRIGGER FOR PATIENTS TABLE
-- ============================================

IF OBJECT_ID('trg_audit_patients', 'TR') IS NOT NULL
    DROP TRIGGER trg_audit_patients;
GO

CREATE TRIGGER trg_audit_patients
ON patients
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Insert operations
    INSERT INTO audit_log (table_name, operation_type, record_id, new_value)
    SELECT 
        'patients', 
        'I', 
        patient_id,
        (SELECT * FROM inserted i WHERE i.patient_id = inserted.patient_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted
    WHERE NOT EXISTS (SELECT 1 FROM deleted);
    
    -- Update operations
    INSERT INTO audit_log (table_name, operation_type, record_id, old_value, new_value)
    SELECT 
        'patients',
        'U',
        i.patient_id,
        (SELECT * FROM deleted d WHERE d.patient_id = i.patient_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT * FROM inserted i2 WHERE i2.patient_id = i.patient_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    WHERE EXISTS (SELECT 1 FROM deleted d WHERE d.patient_id = i.patient_id);
    
    -- Delete operations
    INSERT INTO audit_log (table_name, operation_type, record_id, old_value)
    SELECT 
        'patients',
        'D',
        patient_id,
        (SELECT * FROM deleted d WHERE d.patient_id = deleted.patient_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO

PRINT '✅ Created trg_audit_patients';
GO

-- ============================================
-- 3. AUDIT TRIGGER FOR APPOINTMENTS TABLE
-- ============================================

IF OBJECT_ID('trg_audit_appointments', 'TR') IS NOT NULL
    DROP TRIGGER trg_audit_appointments;
GO

CREATE TRIGGER trg_audit_appointments
ON appointments
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO audit_log (table_name, operation_type, record_id, old_value, new_value)
    SELECT 
        'appointments',
        CASE 
            WHEN EXISTS (SELECT 1 FROM deleted) AND EXISTS (SELECT 1 FROM inserted) THEN 'U'
            WHEN EXISTS (SELECT 1 FROM inserted) THEN 'I'
            ELSE 'D'
        END,
        ISNULL(i.appointment_id, d.appointment_id),
        (SELECT * FROM deleted d2 WHERE d2.appointment_id = d.appointment_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT * FROM inserted i2 WHERE i2.appointment_id = i.appointment_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL OUTER JOIN deleted d ON i.appointment_id = d.appointment_id;
END;
GO

PRINT '✅ Created trg_audit_appointments';
GO

-- ============================================
-- 4. AUDIT TRIGGER FOR EMPLOYEES TABLE
-- ============================================

IF OBJECT_ID('trg_audit_employees', 'TR') IS NOT NULL
    DROP TRIGGER trg_audit_employees;
GO

CREATE TRIGGER trg_audit_employees
ON employees
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO audit_log (table_name, operation_type, record_id, old_value, new_value)
    SELECT 
        'employees',
        CASE 
            WHEN EXISTS (SELECT 1 FROM deleted) AND EXISTS (SELECT 1 FROM inserted) THEN 'U'
            WHEN EXISTS (SELECT 1 FROM inserted) THEN 'I'
            ELSE 'D'
        END,
        ISNULL(i.emp_id, d.emp_id),
        (SELECT * FROM deleted d2 WHERE d2.emp_id = d.emp_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT * FROM inserted i2 WHERE i2.emp_id = i.emp_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL OUTER JOIN deleted d ON i.emp_id = d.emp_id;
END;
GO

PRINT '✅ Created trg_audit_employees';
GO

-- ============================================
-- 5. AUDIT TRIGGER FOR ACCOUNTS TABLE
-- ============================================

IF OBJECT_ID('trg_audit_accounts', 'TR') IS NOT NULL
    DROP TRIGGER trg_audit_accounts;
GO

CREATE TRIGGER trg_audit_accounts
ON accounts
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Mask password_hash in audit log for security
    INSERT INTO audit_log (table_name, operation_type, record_id, old_value, new_value)
    SELECT 
        'accounts',
        CASE 
            WHEN EXISTS (SELECT 1 FROM deleted) AND EXISTS (SELECT 1 FROM inserted) THEN 'U'
            WHEN EXISTS (SELECT 1 FROM inserted) THEN 'I'
            ELSE 'D'
        END,
        ISNULL(i.account_id, d.account_id),
        (SELECT account_id, patient_id, username, '***MASKED***' AS password_hash, last_login, created_at 
         FROM deleted d2 WHERE d2.account_id = d.account_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT account_id, patient_id, username, '***MASKED***' AS password_hash, last_login, created_at 
         FROM inserted i2 WHERE i2.account_id = i.account_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL OUTER JOIN deleted d ON i.account_id = d.account_id;
END;
GO

PRINT '✅ Created trg_audit_accounts (with password masking)';
GO

-- ============================================
-- 6. STORED PROCEDURE: GET AUDIT HISTORY
-- ============================================

IF OBJECT_ID('sp_GetAuditHistory', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetAuditHistory;
GO

CREATE PROCEDURE sp_GetAuditHistory
    @TableName NVARCHAR(100) = NULL,
    @RecordId INT = NULL,
    @StartDate DATETIME2 = NULL,
    @EndDate DATETIME2 = NULL,
    @OperationType CHAR(1) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate inputs
        IF @PageNumber < 1
            SET @PageNumber = 1;
            
        IF @PageSize < 1 OR @PageSize > 1000
            SET @PageSize = 50;
        
        DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
        
        -- Get audit records
        SELECT 
            audit_id,
            table_name,
            CASE operation_type
                WHEN 'I' THEN 'Insert'
                WHEN 'U' THEN 'Update'
                WHEN 'D' THEN 'Delete'
            END AS operation,
            operation_type,
            record_id,
            old_value,
            new_value,
            changed_by,
            changed_at,
            ip_address,
            user_agent
        FROM audit_log
        WHERE (@TableName IS NULL OR table_name = @TableName)
        AND (@RecordId IS NULL OR record_id = @RecordId)
        AND (@StartDate IS NULL OR changed_at >= @StartDate)
        AND (@EndDate IS NULL OR changed_at <= @EndDate)
        AND (@OperationType IS NULL OR operation_type = @OperationType)
        ORDER BY changed_at DESC
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY;
        
        -- Return count
        SELECT COUNT(*) AS TotalRecords
        FROM audit_log
        WHERE (@TableName IS NULL OR table_name = @TableName)
        AND (@RecordId IS NULL OR record_id = @RecordId)
        AND (@StartDate IS NULL OR changed_at >= @StartDate)
        AND (@EndDate IS NULL OR changed_at <= @EndDate)
        AND (@OperationType IS NULL OR operation_type = @OperationType);
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_GetAuditHistory';
GO

-- ============================================
-- 7. STORED PROCEDURE: GET PATIENT AUDIT HISTORY
-- ============================================

IF OBJECT_ID('sp_GetPatientAuditHistory', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetPatientAuditHistory;
GO

CREATE PROCEDURE sp_GetPatientAuditHistory
    @PatientId INT,
    @StartDate DATETIME2 = NULL,
    @EndDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate input
        IF @PatientId IS NULL OR @PatientId <= 0
        BEGIN
            RAISERROR('Invalid Patient ID', 16, 1);
            RETURN;
        END;
        
        -- Get all changes related to this patient
        SELECT 
            audit_id,
            table_name,
            CASE operation_type
                WHEN 'I' THEN 'Created'
                WHEN 'U' THEN 'Updated'
                WHEN 'D' THEN 'Deleted'
            END AS action,
            old_value,
            new_value,
            changed_by,
            changed_at
        FROM audit_log
        WHERE table_name IN ('patients', 'accounts', 'appointments')
        AND record_id = @PatientId
        AND (@StartDate IS NULL OR changed_at >= @StartDate)
        AND (@EndDate IS NULL OR changed_at <= @EndDate)
        ORDER BY changed_at DESC;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_GetPatientAuditHistory';
GO

-- ============================================
-- 8. STORED PROCEDURE: AUDIT SUMMARY REPORT
-- ============================================

IF OBJECT_ID('sp_AuditSummaryReport', 'P') IS NOT NULL
    DROP PROCEDURE sp_AuditSummaryReport;
GO

CREATE PROCEDURE sp_AuditSummaryReport
    @StartDate DATETIME2 = NULL,
    @EndDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Set defaults if not provided
        IF @StartDate IS NULL
            SET @StartDate = DATEADD(DAY, -30, GETDATE());
            
        IF @EndDate IS NULL
            SET @EndDate = GETDATE();
        
        -- Summary by table and operation
        SELECT 
            table_name,
            CASE operation_type
                WHEN 'I' THEN 'Insert'
                WHEN 'U' THEN 'Update'
                WHEN 'D' THEN 'Delete'
            END AS operation,
            COUNT(*) AS total_operations,
            COUNT(DISTINCT changed_by) AS unique_users,
            MIN(changed_at) AS first_change,
            MAX(changed_at) AS last_change
        FROM audit_log
        WHERE changed_at BETWEEN @StartDate AND @EndDate
        GROUP BY table_name, operation_type
        ORDER BY table_name, operation_type;
        
        -- Top users by activity
        SELECT TOP 10
            changed_by AS username,
            COUNT(*) AS total_changes,
            COUNT(DISTINCT table_name) AS tables_modified,
            MIN(changed_at) AS first_activity,
            MAX(changed_at) AS last_activity
        FROM audit_log
        WHERE changed_at BETWEEN @StartDate AND @EndDate
        GROUP BY changed_by
        ORDER BY COUNT(*) DESC;
        
        -- Daily activity trend
        SELECT 
            CAST(changed_at AS DATE) AS date,
            COUNT(*) AS total_changes,
            COUNT(DISTINCT changed_by) AS active_users,
            COUNT(CASE WHEN operation_type = 'I' THEN 1 END) AS inserts,
            COUNT(CASE WHEN operation_type = 'U' THEN 1 END) AS updates,
            COUNT(CASE WHEN operation_type = 'D' THEN 1 END) AS deletes
        FROM audit_log
        WHERE changed_at BETWEEN @StartDate AND @EndDate
        GROUP BY CAST(changed_at AS DATE)
        ORDER BY CAST(changed_at AS DATE) DESC;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

PRINT '✅ Created sp_AuditSummaryReport';
GO

-- ============================================
-- 9. VIEW: RECENT AUDIT ACTIVITIES
-- ============================================

IF OBJECT_ID('vw_RecentAuditActivities', 'V') IS NOT NULL
    DROP VIEW vw_RecentAuditActivities;
GO

CREATE VIEW vw_RecentAuditActivities AS
SELECT TOP 1000
    audit_id,
    table_name,
    CASE operation_type
        WHEN 'I' THEN 'Insert'
        WHEN 'U' THEN 'Update'
        WHEN 'D' THEN 'Delete'
    END AS operation,
    record_id,
    changed_by,
    changed_at,
    DATEDIFF(MINUTE, changed_at, GETDATE()) AS minutes_ago,
    CASE 
        WHEN DATEDIFF(MINUTE, changed_at, GETDATE()) < 60 THEN CONCAT(DATEDIFF(MINUTE, changed_at, GETDATE()), ' minutes ago')
        WHEN DATEDIFF(HOUR, changed_at, GETDATE()) < 24 THEN CONCAT(DATEDIFF(HOUR, changed_at, GETDATE()), ' hours ago')
        ELSE CONCAT(DATEDIFF(DAY, changed_at, GETDATE()), ' days ago')
    END AS time_ago
FROM audit_log
ORDER BY changed_at DESC;
GO

PRINT '✅ Created vw_RecentAuditActivities';
GO

-- ============================================
-- 10. SAMPLE QUERIES AND TESTING
-- ============================================

PRINT '';
PRINT '📝 Sample queries to test audit system:';
PRINT '';
PRINT '-- View recent audit activities:
SELECT TOP 20 * FROM vw_RecentAuditActivities;';
PRINT '';
PRINT '-- Get audit history for a specific table:
EXEC sp_GetAuditHistory 
    @TableName = ''patients'',
    @PageNumber = 1,
    @PageSize = 20;';
PRINT '';
PRINT '-- Get audit history for a specific patient:
EXEC sp_GetPatientAuditHistory @PatientId = 1;';
PRINT '';
PRINT '-- Get audit summary report for last 30 days:
EXEC sp_AuditSummaryReport 
    @StartDate = ''2024-01-01'',
    @EndDate = ''2024-12-31'';';
PRINT '';
PRINT '-- Test audit trail (make some changes):
UPDATE patients SET address = N''Updated address'' WHERE patient_id = 1;
SELECT TOP 5 * FROM audit_log WHERE table_name = ''patients'' ORDER BY changed_at DESC;';
GO

-- ============================================
-- 11. AUDIT RETENTION POLICY (Optional)
-- ============================================

PRINT '';
PRINT '💡 Audit Retention Policy:';
PRINT 'Consider running this monthly to clean old audit records:';
PRINT '
-- Delete audit records older than 2 years
DELETE FROM audit_log 
WHERE changed_at < DATEADD(YEAR, -2, GETDATE());

-- Or archive them to a separate table:
SELECT * INTO audit_log_archive_2024 
FROM audit_log 
WHERE YEAR(changed_at) = 2024;
';
GO

PRINT '✨ ============================================';
PRINT '✅ Audit trail system created successfully!';
PRINT '📋 Tables: audit_log';
PRINT '🔔 Triggers: 4 audit triggers (patients, appointments, employees, accounts)';
PRINT '📊 Procedures: 3 audit procedures';
PRINT '🔍 Views: vw_RecentAuditActivities';
PRINT '🔒 Security: Password masking in accounts audit';
PRINT '💡 Tip: All changes are now automatically tracked!';
PRINT '============================================';
GO
