-- ======================================================
-- INDEXING STRATEGY FOR CLINIC MANAGEMENT SYSTEM
-- Tối ưu performance cho queries (QUAN TRỌNG cho CSDL nâng cao)
-- ======================================================
-- Chạy file này SAU KHI đã tạo tables và insert data
-- ======================================================

USE ClinicDB;
GO

PRINT '🚀 Bắt đầu tạo indexes...';
GO

-- ============================================
-- A. INDEXES CHO PATIENTS TABLE
-- ============================================

-- Index cho phone lookup (rất thường dùng khi tìm bệnh nhân)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patients_phone' AND object_id = OBJECT_ID('patients'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_patients_phone 
    ON patients(phone)
    INCLUDE (fullname, email, date_of_birth);
    PRINT '✅ Created idx_patients_phone';
END;
GO

-- Index cho email lookup
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patients_email' AND object_id = OBJECT_ID('patients'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_patients_email 
    ON patients(email)
    INCLUDE (fullname, phone);
    PRINT '✅ Created idx_patients_email';
END;
GO

-- Index cho BHYT lookup
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patients_bhyt' AND object_id = OBJECT_ID('patients'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_patients_bhyt 
    ON patients(bhyt_info)
    WHERE bhyt_info IS NOT NULL; -- Filtered index
    PRINT '✅ Created idx_patients_bhyt';
END;
GO

-- Index cho name search (supports LIKE 'John%')
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patients_fullname' AND object_id = OBJECT_ID('patients'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_patients_fullname 
    ON patients(fullname);
    PRINT '✅ Created idx_patients_fullname';
END;
GO

-- Index cho date range queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patients_created_at' AND object_id = OBJECT_ID('patients'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_patients_created_at 
    ON patients(created_at DESC);
    PRINT '✅ Created idx_patients_created_at';
END;
GO

-- ============================================
-- B. INDEXES CHO APPOINTMENTS TABLE (QUAN TRỌNG NHẤT!)
-- ============================================

-- Composite index cho patient appointments lookup
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_appointments_patient_schedule' AND object_id = OBJECT_ID('appointments'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_appointments_patient_schedule 
    ON appointments(patient_id, schedule_id, scheduled_time DESC)
    INCLUDE (status, service_type, notes);
    PRINT '✅ Created idx_appointments_patient_schedule';
END;
GO

-- Index cho schedule-based queries (bác sĩ xem appointments)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_appointments_schedule_status' AND object_id = OBJECT_ID('appointments'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_appointments_schedule_status 
    ON appointments(schedule_id, status)
    INCLUDE (patient_id, scheduled_time, service_type);
    PRINT '✅ Created idx_appointments_schedule_status';
END;
GO

-- Index cho status filtering
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_appointments_status' AND object_id = OBJECT_ID('appointments'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_appointments_status 
    ON appointments(status)
    INCLUDE (patient_id, schedule_id, scheduled_time);
    PRINT '✅ Created idx_appointments_status';
END;
GO

-- Index cho date range queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_appointments_scheduled_time' AND object_id = OBJECT_ID('appointments'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_appointments_scheduled_time 
    ON appointments(scheduled_time DESC)
    INCLUDE (patient_id, schedule_id, status, service_type);
    PRINT '✅ Created idx_appointments_scheduled_time';
END;
GO

-- Covering index cho appointment list queries (tối ưu read performance)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_appointments_covering' AND object_id = OBJECT_ID('appointments'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_appointments_covering 
    ON appointments(patient_id, schedule_id, scheduled_time DESC, status)
    INCLUDE (service_type, notes, rating, created_at);
    PRINT '✅ Created idx_appointments_covering';
END;
GO

-- ============================================
-- C. INDEXES CHO EMPLOYEES & DOCTORS
-- ============================================

-- Index cho employee type filtering
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_employees_type' AND object_id = OBJECT_ID('employees'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_employees_type 
    ON employees(employee_type)
    INCLUDE (fullname, email, phone);
    PRINT '✅ Created idx_employees_type';
END;
GO

-- Index cho email lookup
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_employees_email' AND object_id = OBJECT_ID('employees'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_employees_email 
    ON employees(email)
    INCLUDE (fullname, employee_type);
    PRINT '✅ Created idx_employees_email';
END;
GO

-- Index cho doctor salary queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_doctors_salary' AND object_id = OBJECT_ID('doctors'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_doctors_salary 
    ON doctors(salary_per_appointment DESC);
    PRINT '✅ Created idx_doctors_salary';
END;
GO

-- ============================================
-- D. INDEXES CHO SCHEDULES TABLE
-- ============================================

-- Composite index cho schedule lookup by doctor & clinic
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_schedules_doctor_clinic' AND object_id = OBJECT_ID('schedules'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_schedules_doctor_clinic 
    ON schedules(doctor_id, clinic_id, day_of_week)
    INCLUDE (start_time, end_time, max_patients);
    PRINT '✅ Created idx_schedules_doctor_clinic';
END;
GO

-- Index cho clinic-based queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_schedules_clinic_day' AND object_id = OBJECT_ID('schedules'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_schedules_clinic_day 
    ON schedules(clinic_id, day_of_week)
    INCLUDE (doctor_id, start_time, end_time, max_patients);
    PRINT '✅ Created idx_schedules_clinic_day';
END;
GO

-- Index cho day_of_week queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_schedules_day_of_week' AND object_id = OBJECT_ID('schedules'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_schedules_day_of_week 
    ON schedules(day_of_week)
    INCLUDE (doctor_id, clinic_id, start_time, end_time);
    PRINT '✅ Created idx_schedules_day_of_week';
END;
GO

-- ============================================
-- E. INDEXES CHO SALARY_RECORDS TABLE
-- ============================================

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'salary_records')
BEGIN
    -- Index cho employee salary lookup by month
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_salary_records_emp_month' AND object_id = OBJECT_ID('salary_records'))
    BEGIN
        CREATE NONCLUSTERED INDEX idx_salary_records_emp_month 
        ON salary_records(emp_id, month DESC)
        INCLUDE (total_salary, calculated_at);
        PRINT '✅ Created idx_salary_records_emp_month';
    END;

    -- Index cho accountant queries
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_salary_records_accountant' AND object_id = OBJECT_ID('salary_records'))
    BEGIN
        CREATE NONCLUSTERED INDEX idx_salary_records_accountant 
        ON salary_records(accountant_id, month DESC);
        PRINT '✅ Created idx_salary_records_accountant';
    END;
END;
GO

-- ============================================
-- F. INDEXES CHO FOREIGN KEYS (SQL Server không tự tạo!)
-- ============================================

-- accounts table
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_accounts_patient_id' AND object_id = OBJECT_ID('accounts'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_accounts_patient_id 
    ON accounts(patient_id);
    PRINT '✅ Created idx_accounts_patient_id';
END;
GO

-- doctor_specialties table
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_doctor_specialties_specialty' AND object_id = OBJECT_ID('doctor_specialties'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_doctor_specialties_specialty 
    ON doctor_specialties(specialty_id);
    PRINT '✅ Created idx_doctor_specialties_specialty';
END;
GO

-- staff table
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_staff_clinic' AND object_id = OBJECT_ID('staff'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_staff_clinic 
    ON staff(clinic_id);
    PRINT '✅ Created idx_staff_clinic';
END;
GO

-- ============================================
-- G. UPDATE STATISTICS (Quan trọng cho query optimizer)
-- ============================================

PRINT '📊 Updating statistics...';
GO

UPDATE STATISTICS patients WITH FULLSCAN;
UPDATE STATISTICS appointments WITH FULLSCAN;
UPDATE STATISTICS schedules WITH FULLSCAN;
UPDATE STATISTICS employees WITH FULLSCAN;
UPDATE STATISTICS doctors WITH FULLSCAN;
UPDATE STATISTICS accounts WITH FULLSCAN;

PRINT '✅ Statistics updated!';
GO

-- ============================================
-- H. INDEX MAINTENANCE QUERY (Chạy monthly)
-- ============================================

PRINT '📋 Index maintenance script ready. Run this query monthly:';
PRINT '
-- Check index fragmentation
SELECT 
    OBJECT_NAME(ips.object_id) AS TableName,
    i.name AS IndexName,
    ips.index_type_desc,
    ips.avg_fragmentation_in_percent,
    ips.page_count,
    CASE 
        WHEN ips.avg_fragmentation_in_percent > 30 THEN ''REBUILD''
        WHEN ips.avg_fragmentation_in_percent > 10 THEN ''REORGANIZE''
        ELSE ''OK''
    END AS Recommendation
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, ''LIMITED'') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10
AND ips.page_count > 100
ORDER BY ips.avg_fragmentation_in_percent DESC;
';
GO

PRINT '✨ ============================================';
PRINT '✅ All indexes created successfully!';
PRINT '📈 Performance optimized for queries';
PRINT '💡 Tip: Run UPDATE STATISTICS monthly for best performance';
PRINT '============================================';
GO
