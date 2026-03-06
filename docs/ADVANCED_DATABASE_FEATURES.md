# 🚀 Advanced Database Features Implementation Guide

Chi tiết implementation cho các tính năng CSDL nâng cao để đạt chuẩn quốc tế.

---

## 📑 MỤC LỤC

1. [Database Indexing Strategy](#1-database-indexing-strategy)
2. [Advanced Stored Procedures](#2-advanced-stored-procedures)
3. [Views for Complex Queries](#3-views-for-complex-queries)
4. [Audit Trail System](#4-audit-trail-system)
5. [Full-Text Search](#5-full-text-search)
6. [Database Partitioning](#6-database-partitioning)
7. [Query Optimization](#7-query-optimization)
8. [Backup & Recovery](#8-backup--recovery)

---

## 1. DATABASE INDEXING STRATEGY

### File: `Data/create_indexes.sql`

```sql
-- ======================================================
-- INDEXING STRATEGY FOR CLINIC MANAGEMENT SYSTEM
-- Performance optimization for queries
-- ======================================================

USE ClinicDB;
GO

-- ============================================
-- A. PRIMARY TABLES INDEXES
-- ============================================

-- PATIENTS TABLE
-- Single-column indexes for frequent WHERE clauses
CREATE NONCLUSTERED INDEX idx_patients_phone 
ON patients(phone)
INCLUDE (fullname, email); -- Covering index

CREATE NONCLUSTERED INDEX idx_patients_email 
ON patients(email)
INCLUDE (fullname, phone);

CREATE NONCLUSTERED INDEX idx_patients_bhyt 
ON patients(bhyt_info)
WHERE bhyt_info IS NOT NULL; -- Filtered index

-- Index for name search (supports LIKE 'John%')
CREATE NONCLUSTERED INDEX idx_patients_fullname 
ON patients(fullname);

-- Index for date range queries
CREATE NONCLUSTERED INDEX idx_patients_created_at 
ON patients(created_at DESC);

-- ============================================
-- APPOINTMENTS TABLE (MOST CRITICAL)
-- ============================================

-- Composite index for common queries
CREATE NONCLUSTERED INDEX idx_appointments_patient_schedule 
ON appointments(patient_id, schedule_id, scheduled_time DESC)
INCLUDE (status, service_type);

-- Index for doctor's appointments lookup
CREATE NONCLUSTERED INDEX idx_appointments_schedule_status 
ON appointments(schedule_id, status)
INCLUDE (patient_id, scheduled_time, service_type);

-- Index for status filtering
CREATE NONCLUSTERED INDEX idx_appointments_status 
ON appointments(status)
INCLUDE (patient_id, schedule_id, scheduled_time);

-- Index for date range queries
CREATE NONCLUSTERED INDEX idx_appointments_scheduled_time 
ON appointments(scheduled_time DESC)
INCLUDE (patient_id, schedule_id, status);

-- Covering index for appointment list queries
CREATE NONCLUSTERED INDEX idx_appointments_covering 
ON appointments(patient_id, schedule_id, scheduled_time, status)
INCLUDE (service_type, notes, created_at);

-- ============================================
-- EMPLOYEES & DOCTORS
-- ============================================

-- Index for employee type filtering
CREATE NONCLUSTERED INDEX idx_employees_type 
ON employees(employee_type)
INCLUDE (fullname, email, phone);

-- Index for doctor lookup
CREATE NONCLUSTERED INDEX idx_doctors_salary 
ON doctors(salary_per_appointment);

-- ============================================
-- SCHEDULES TABLE
-- ============================================

-- Composite index for schedule lookup
CREATE NONCLUSTERED INDEX idx_schedules_doctor_clinic 
ON schedules(doctor_id, clinic_id, day_of_week)
INCLUDE (start_time, end_time, max_patients);

-- Index for clinic-based queries
CREATE NONCLUSTERED INDEX idx_schedules_clinic_day 
ON schedules(clinic_id, day_of_week)
INCLUDE (doctor_id, start_time, end_time);

-- ============================================
-- SALARY & FINANCIAL TABLES
-- ============================================

-- Index for salary lookup by employee and month
CREATE NONCLUSTERED INDEX idx_salary_records_emp_month 
ON salary_records(emp_id, month DESC)
INCLUDE (total_salary, calculated_at);

-- Index for accountant queries
CREATE NONCLUSTERED INDEX idx_salary_records_accountant 
ON salary_records(accountant_id, month DESC);

-- ============================================
-- B. FOREIGN KEY INDEXES
-- (SQL Server doesn't auto-create these!)
-- ============================================

-- accounts table
CREATE NONCLUSTERED INDEX idx_accounts_patient_id 
ON accounts(patient_id);

-- doctor_specialties table
CREATE NONCLUSTERED INDEX idx_doctor_specialties_specialty 
ON doctor_specialties(specialty_id);

-- staff table
CREATE NONCLUSTERED INDEX idx_staff_clinic 
ON staff(clinic_id);

-- ============================================
-- C. STATISTICS UPDATE
-- ============================================

-- Update statistics for better query plans
UPDATE STATISTICS patients WITH FULLSCAN;
UPDATE STATISTICS appointments WITH FULLSCAN;
UPDATE STATISTICS schedules WITH FULLSCAN;
UPDATE STATISTICS employees WITH FULLSCAN;

-- ============================================
-- D. INDEX MAINTENANCE SCRIPT
-- (Run monthly)
-- ============================================

-- Check index fragmentation
SELECT 
    OBJECT_NAME(ips.object_id) AS TableName,
    i.name AS IndexName,
    ips.index_type_desc,
    ips.avg_fragmentation_in_percent,
    ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10
AND ips.page_count > 100
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- Rebuild fragmented indexes (>30% fragmentation)
DECLARE @TableName NVARCHAR(255);
DECLARE @IndexName NVARCHAR(255);
DECLARE @SQL NVARCHAR(MAX);

DECLARE index_cursor CURSOR FOR
SELECT 
    OBJECT_NAME(ips.object_id),
    i.name
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 30
AND ips.page_count > 100;

OPEN index_cursor;
FETCH NEXT FROM index_cursor INTO @TableName, @IndexName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @SQL = 'ALTER INDEX ' + @IndexName + ' ON ' + @TableName + ' REBUILD;';
    EXEC sp_executesql @SQL;
    PRINT 'Rebuilt index: ' + @IndexName + ' on ' + @TableName;
    
    FETCH NEXT FROM index_cursor INTO @TableName, @IndexName;
END;

CLOSE index_cursor;
DEALLOCATE index_cursor;
GO

PRINT 'Index creation completed successfully!';
```

---

## 2. ADVANCED STORED PROCEDURES

### File: `Data/advanced_procedures.sql`

```sql
-- ======================================================
-- ADVANCED STORED PROCEDURES
-- Complex business logic implementations
-- ======================================================

USE ClinicDB;
GO

-- ============================================
-- 1. GET PATIENT HISTORY WITH PAGINATION
-- ============================================

CREATE OR ALTER PROCEDURE sp_GetPatientHistory
    @PatientId INT,
    @PageNumber INT = 1,
    @PageSize INT = 10,
    @SortBy NVARCHAR(50) = 'scheduled_time',
    @SortOrder NVARCHAR(4) = 'DESC',
    @TotalRecords INT OUTPUT,
    @TotalPages INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Calculate total records
        SELECT @TotalRecords = COUNT(*) 
        FROM appointments a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE a.patient_id = @PatientId;
        
        -- Calculate total pages
        SET @TotalPages = CEILING(CAST(@TotalRecords AS FLOAT) / @PageSize);
        
        -- Build dynamic SQL for sorting
        DECLARE @SQL NVARCHAR(MAX);
        DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
        
        SET @SQL = '
        SELECT 
            a.appointment_id,
            a.scheduled_time,
            a.status,
            a.service_type,
            a.notes,
            a.rating,
            e.fullname AS doctor_name,
            sp.name AS specialty_name,
            c.name AS clinic_name
        FROM appointments a
        JOIN schedules sch ON a.schedule_id = sch.schedule_id
        JOIN doctors d ON sch.doctor_id = d.doctor_id
        JOIN employees e ON d.doctor_id = e.emp_id
        JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
        JOIN specialties sp ON ds.specialty_id = sp.specialty_id
        JOIN clinics c ON sch.clinic_id = c.clinic_id
        WHERE a.patient_id = @PatientId
        ORDER BY ' + QUOTENAME(@SortBy) + ' ' + @SortOrder + '
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY';
        
        EXEC sp_executesql @SQL, 
            N'@PatientId INT, @Offset INT, @PageSize INT',
            @PatientId, @Offset, @PageSize;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- ============================================
-- 2. MONTHLY REVENUE REPORT BY DOCTOR
-- ============================================

CREATE OR ALTER PROCEDURE sp_MonthlyRevenueReport
    @StartDate DATE,
    @EndDate DATE,
    @DoctorId INT = NULL,
    @ClinicId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    WITH DoctorRevenue AS (
        SELECT 
            e.emp_id,
            e.fullname AS doctor_name,
            sp.name AS specialty_name,
            c.name AS clinic_name,
            COUNT(DISTINCT a.appointment_id) AS total_appointments,
            COUNT(DISTINCT a.patient_id) AS unique_patients,
            SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
            AVG(CASE WHEN a.rating IS NOT NULL THEN CAST(a.rating AS FLOAT) END) AS avg_rating,
            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_count,
            COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_count,
            COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS no_show_count
        FROM employees e
        JOIN doctors d ON e.emp_id = d.doctor_id
        JOIN schedules s ON d.doctor_id = s.doctor_id
        JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
        JOIN specialties sp ON ds.specialty_id = sp.specialty_id
        JOIN clinics c ON s.clinic_id = c.clinic_id
        LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
            AND CAST(a.scheduled_time AS DATE) BETWEEN @StartDate AND @EndDate
        WHERE (@DoctorId IS NULL OR e.emp_id = @DoctorId)
        AND (@ClinicId IS NULL OR s.clinic_id = @ClinicId)
        GROUP BY e.emp_id, e.fullname, sp.name, c.name
    )
    SELECT 
        *,
        CASE 
            WHEN total_appointments > 0 
            THEN CAST(completed_count AS FLOAT) / total_appointments * 100 
            ELSE 0 
        END AS completion_rate,
        CASE 
            WHEN total_appointments > 0 
            THEN total_revenue / total_appointments 
            ELSE 0 
        END AS revenue_per_appointment
    FROM DoctorRevenue
    ORDER BY total_revenue DESC;
END;
GO

-- ============================================
-- 3. FIND AVAILABLE TIME SLOTS
-- ============================================

CREATE OR ALTER PROCEDURE sp_FindAvailableTimeSlots
    @DoctorId INT = NULL,
    @SpecialtyId INT = NULL,
    @ClinicId INT = NULL,
    @Date DATE,
    @Duration INT = 30 -- minutes
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get day of week (1=Monday, 7=Sunday)
    DECLARE @DayOfWeek INT = (DATEPART(WEEKDAY, @Date) + @@DATEFIRST - 2) % 7 + 1;
    
    WITH TimeSlots AS (
        SELECT 
            s.schedule_id,
            s.doctor_id,
            e.fullname AS doctor_name,
            sp.name AS specialty_name,
            c.name AS clinic_name,
            s.start_time,
            s.end_time,
            s.max_patients,
            -- Generate time slots
            DATEADD(MINUTE, v.number * @Duration, 
                CAST(@Date AS DATETIME) + CAST(s.start_time AS DATETIME)) AS slot_time
        FROM schedules s
        JOIN doctors d ON s.doctor_id = d.doctor_id
        JOIN employees e ON d.doctor_id = e.emp_id
        JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
        JOIN specialties sp ON ds.specialty_id = sp.specialty_id
        JOIN clinics c ON s.clinic_id = c.clinic_id
        CROSS JOIN master..spt_values v
        WHERE s.day_of_week = @DayOfWeek
        AND v.type = 'P'
        AND v.number < DATEDIFF(MINUTE, s.start_time, s.end_time) / @Duration
        AND (@DoctorId IS NULL OR s.doctor_id = @DoctorId)
        AND (@SpecialtyId IS NULL OR ds.specialty_id = @SpecialtyId)
        AND (@ClinicId IS NULL OR s.clinic_id = @ClinicId)
    ),
    BookedSlots AS (
        SELECT 
            ts.slot_time,
            ts.schedule_id,
            COUNT(a.appointment_id) AS booked_count
        FROM TimeSlots ts
        LEFT JOIN appointments a ON ts.schedule_id = a.schedule_id
            AND a.scheduled_time = ts.slot_time
            AND a.status NOT IN ('cancelled', 'no-show')
        GROUP BY ts.slot_time, ts.schedule_id
    )
    SELECT 
        ts.schedule_id,
        ts.doctor_id,
        ts.doctor_name,
        ts.specialty_name,
        ts.clinic_name,
        ts.slot_time,
        ts.max_patients,
        ISNULL(bs.booked_count, 0) AS booked_count,
        ts.max_patients - ISNULL(bs.booked_count, 0) AS available_slots
    FROM TimeSlots ts
    LEFT JOIN BookedSlots bs ON ts.slot_time = bs.slot_time 
        AND ts.schedule_id = bs.schedule_id
    WHERE ts.max_patients - ISNULL(bs.booked_count, 0) > 0
    AND ts.slot_time > GETDATE() -- Only future slots
    ORDER BY ts.slot_time;
END;
GO

-- ============================================
-- 4. CALCULATE DOCTOR PERFORMANCE METRICS
-- ============================================

CREATE OR ALTER PROCEDURE sp_CalculateDoctorPerformance
    @DoctorId INT,
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        @DoctorId AS doctor_id,
        e.fullname AS doctor_name,
        
        -- Appointment metrics
        COUNT(a.appointment_id) AS total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_appointments,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_appointments,
        COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS no_show_appointments,
        
        -- Patient metrics
        COUNT(DISTINCT a.patient_id) AS unique_patients,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.patient_id END) AS completed_unique_patients,
        
        -- Financial metrics
        SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
        AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
        
        -- Quality metrics
        AVG(CASE WHEN a.rating IS NOT NULL THEN CAST(a.rating AS FLOAT) END) AS avg_rating,
        COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) AS total_ratings,
        
        -- Efficiency metrics
        CASE 
            WHEN COUNT(a.appointment_id) > 0 
            THEN CAST(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS FLOAT) 
                 / COUNT(a.appointment_id) * 100 
            ELSE 0 
        END AS completion_rate,
        
        CASE 
            WHEN COUNT(a.appointment_id) > 0 
            THEN CAST(COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) AS FLOAT) 
                 / COUNT(a.appointment_id) * 100 
            ELSE 0 
        END AS no_show_rate,
        
        -- Time period
        @StartDate AS period_start,
        @EndDate AS period_end,
        DATEDIFF(DAY, @StartDate, @EndDate) + 1 AS period_days
        
    FROM employees e
    JOIN doctors d ON e.emp_id = d.doctor_id
    LEFT JOIN schedules s ON d.doctor_id = s.doctor_id
    LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
        AND CAST(a.scheduled_time AS DATE) BETWEEN @StartDate AND @EndDate
    WHERE e.emp_id = @DoctorId
    GROUP BY e.emp_id, e.fullname, d.salary_per_appointment;
END;
GO

-- ============================================
-- 5. PATIENT APPOINTMENT REMINDER
-- ============================================

CREATE OR ALTER PROCEDURE sp_GetUpcomingAppointments
    @ReminderHours INT = 24 -- Send reminder 24 hours before
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ReminderTime DATETIME2 = DATEADD(HOUR, @ReminderHours, GETDATE());
    
    SELECT 
        a.appointment_id,
        p.patient_id,
        p.fullname AS patient_name,
        p.email AS patient_email,
        p.phone AS patient_phone,
        a.scheduled_time,
        e.fullname AS doctor_name,
        sp.name AS specialty_name,
        c.name AS clinic_name,
        c.address AS clinic_address,
        a.service_type,
        a.notes,
        DATEDIFF(HOUR, GETDATE(), a.scheduled_time) AS hours_until_appointment
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN schedules sch ON a.schedule_id = sch.schedule_id
    JOIN doctors d ON sch.doctor_id = d.doctor_id
    JOIN employees e ON d.doctor_id = e.emp_id
    JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
    JOIN specialties sp ON ds.specialty_id = sp.specialty_id
    JOIN clinics c ON sch.clinic_id = c.clinic_id
    WHERE a.status = 'scheduled'
    AND a.scheduled_time BETWEEN GETDATE() AND @ReminderTime
    AND NOT EXISTS (
        -- Check if reminder already sent
        SELECT 1 FROM notifications n
        WHERE n.appointment_id = a.appointment_id
        AND n.notification_type = 'appointment_reminder'
        AND n.sent_at >= DATEADD(DAY, -1, GETDATE())
    )
    ORDER BY a.scheduled_time;
END;
GO

-- ============================================
-- 6. BULK APPOINTMENT CANCELLATION
-- ============================================

CREATE OR ALTER PROCEDURE sp_BulkCancelAppointments
    @DoctorId INT,
    @StartDate DATETIME2,
    @EndDate DATETIME2,
    @Reason NVARCHAR(MAX),
    @CancelledBy INT,
    @CancelledCount INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- Update appointments to cancelled
        UPDATE a
        SET 
            status = 'cancelled',
            notes = CONCAT(ISNULL(notes, ''), ' | Cancelled by doctor: ', @Reason)
        FROM appointments a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE s.doctor_id = @DoctorId
        AND a.scheduled_time BETWEEN @StartDate AND @EndDate
        AND a.status = 'scheduled';
        
        SET @CancelledCount = @@ROWCOUNT;
        
        -- Log the bulk cancellation
        INSERT INTO cancellation_log (doctor_id, start_date, end_date, reason, cancelled_by, cancelled_count, created_at)
        VALUES (@DoctorId, @StartDate, @EndDate, @Reason, @CancelledBy, @CancelledCount, GETDATE());
        
        -- Create notifications for patients
        INSERT INTO notifications (patient_id, appointment_id, notification_type, message, created_at)
        SELECT 
            a.patient_id,
            a.appointment_id,
            'appointment_cancelled',
            CONCAT('Your appointment on ', FORMAT(a.scheduled_time, 'dd/MM/yyyy HH:mm'), 
                   ' has been cancelled. Reason: ', @Reason),
            GETDATE()
        FROM appointments a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE s.doctor_id = @DoctorId
        AND a.scheduled_time BETWEEN @StartDate AND @EndDate
        AND a.status = 'cancelled';
        
        COMMIT TRANSACTION;
        
        PRINT CONCAT('Successfully cancelled ', @CancelledCount, ' appointments');
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

PRINT 'Advanced stored procedures created successfully!';
```

---

## 3. VIEWS FOR COMPLEX QUERIES

### File: `Data/create_views.sql`

```sql
-- ======================================================
-- REPORTING VIEWS
-- Pre-computed views for common reports
-- ======================================================

USE ClinicDB;
GO

-- ============================================
-- 1. DOCTOR KPI DASHBOARD VIEW
-- ============================================

CREATE OR ALTER VIEW vw_DoctorKPI AS
SELECT 
    e.emp_id AS doctor_id,
    e.fullname AS doctor_name,
    e.email,
    e.phone,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    
    -- Appointment metrics (all time)
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    COUNT(DISTINCT a.patient_id) AS total_patients,
    
    -- Financial metrics
    SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
    AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
    
    -- Quality metrics
    AVG(CASE WHEN a.rating IS NOT NULL THEN CAST(a.rating AS FLOAT) END) AS avg_rating,
    COUNT(CASE WHEN a.rating IS NOT NULL THEN 1 END) AS total_ratings,
    
    -- Efficiency metrics
    CASE 
        WHEN COUNT(a.appointment_id) > 0 
        THEN CAST(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS FLOAT) / COUNT(a.appointment_id) * 100 
        ELSE 0 
    END AS completion_rate
    
FROM employees e
JOIN doctors d ON e.emp_id = d.doctor_id
LEFT JOIN schedules s ON d.doctor_id = s.doctor_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
LEFT JOIN clinics c ON s.clinic_id = c.clinic_id
LEFT JOIN appointments a ON s.schedule_id = a.schedule_id
WHERE e.employee_type = 'D'
GROUP BY e.emp_id, e.fullname, e.email, e.phone, sp.name, c.name, d.salary_per_appointment;
GO

-- ============================================
-- 2. PATIENT DETAIL VIEW
-- ============================================

CREATE OR ALTER VIEW vw_PatientDetails AS
SELECT 
    p.patient_id,
    p.fullname,
    p.date_of_birth,
    DATEDIFF(YEAR, p.date_of_birth, GETDATE()) AS age,
    p.gender,
    p.phone,
    p.email,
    p.address,
    p.bhyt_info,
    
    -- Account info
    acc.username,
    acc.last_login,
    
    -- Appointment statistics
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    MAX(a.scheduled_time) AS last_visit_date,
    MIN(a.scheduled_time) AS first_visit_date,
    
    -- Registration info
    p.created_at AS registration_date,
    DATEDIFF(DAY, p.created_at, GETDATE()) AS days_since_registration
    
FROM patients p
LEFT JOIN accounts acc ON p.patient_id = acc.patient_id
LEFT JOIN appointments a ON p.patient_id = a.patient_id
GROUP BY 
    p.patient_id, p.fullname, p.date_of_birth, p.gender, 
    p.phone, p.email, p.address, p.bhyt_info,
    acc.username, acc.last_login, p.created_at;
GO

-- ============================================
-- 3. APPOINTMENT FULL DETAILS VIEW
-- ============================================

CREATE OR ALTER VIEW vw_AppointmentDetails AS
SELECT 
    a.appointment_id,
    a.scheduled_time,
    a.status,
    a.service_type,
    a.notes,
    a.rating,
    
    -- Patient info
    p.patient_id,
    p.fullname AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email,
    
    -- Doctor info
    e.emp_id AS doctor_id,
    e.fullname AS doctor_name,
    e.email AS doctor_email,
    sp.name AS specialty_name,
    
    -- Clinic info
    c.clinic_id,
    c.name AS clinic_name,
    c.address AS clinic_address,
    
    -- Schedule info
    s.day_of_week,
    s.start_time,
    s.end_time,
    
    -- Financial
    d.salary_per_appointment AS fee,
    
    -- Timestamps
    a.created_at,
    a.updated_at
    
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
JOIN schedules s ON a.schedule_id = s.schedule_id
JOIN doctors doc ON s.doctor_id = doc.doctor_id
JOIN employees e ON doc.doctor_id = e.emp_id
JOIN doctor_specialties ds ON doc.doctor_id = ds.doctor_id
JOIN specialties sp ON ds.specialty_id = sp.specialty_id
JOIN clinics c ON s.clinic_id = c.clinic_id;
GO

-- ============================================
-- 4. MONTHLY REVENUE SUMMARY VIEW
-- ============================================

CREATE OR ALTER VIEW vw_MonthlyRevenueSummary AS
SELECT 
    CONVERT(CHAR(7), a.scheduled_time, 126) AS month,
    c.name AS clinic_name,
    sp.name AS specialty_name,
    
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_appointments,
    COUNT(DISTINCT a.patient_id) AS unique_patients,
    
    SUM(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment ELSE 0 END) AS total_revenue,
    AVG(CASE WHEN a.status = 'completed' THEN d.salary_per_appointment END) AS avg_revenue_per_appointment,
    
    COUNT(DISTINCT s.doctor_id) AS active_doctors
    
FROM appointments a
JOIN schedules s ON a.schedule_id = s.schedule_id
JOIN doctors d ON s.doctor_id = d.doctor_id
JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
JOIN specialties sp ON ds.specialty_id = sp.specialty_id
JOIN clinics c ON s.clinic_id = c.clinic_id
GROUP BY CONVERT(CHAR(7), a.scheduled_time, 126), c.name, sp.name;
GO

-- ============================================
-- 5. DOCTOR SCHEDULE VIEW
-- ============================================

CREATE OR ALTER VIEW vw_DoctorScheduleDetails AS
SELECT 
    s.schedule_id,
    s.doctor_id,
    e.fullname AS doctor_name,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    c.address AS clinic_address,
    
    s.day_of_week,
    CASE s.day_of_week
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
        WHEN 7 THEN 'Sunday'
    END AS day_name,
    
    s.start_time,
    s.end_time,
    s.max_patients,
    
    -- Manager info
    mgr.fullname AS manager_name,
    
    s.created_at
    
FROM schedules s
JOIN doctors d ON s.doctor_id = d.doctor_id
JOIN employees e ON d.doctor_id = e.emp_id
JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
JOIN specialties sp ON ds.specialty_id = sp.specialty_id
JOIN clinics c ON s.clinic_id = c.clinic_id
LEFT JOIN employees mgr ON s.manager_id = mgr.emp_id;
GO

PRINT 'Views created successfully!';
```

---

## 4. AUDIT TRAIL SYSTEM

### File: `Data/audit_system.sql`

```sql
-- ======================================================
-- AUDIT TRAIL SYSTEM
-- Track all data changes for compliance
-- ======================================================

USE ClinicDB;
GO

-- ============================================
-- 1. CREATE AUDIT LOG TABLE
-- ============================================

CREATE TABLE audit_log (
    audit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    table_name NVARCHAR(100) NOT NULL,
    operation_type CHAR(1) NOT NULL CHECK (operation_type IN ('I', 'U', 'D')),
    record_id INT NOT NULL,
    old_value NVARCHAR(MAX),
    new_value NVARCHAR(MAX),
    changed_by NVARCHAR(255) DEFAULT SYSTEM_USER,
    changed_at DATETIME2 DEFAULT GETDATE(),
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500)
);
GO

-- Index for faster queries
CREATE NONCLUSTERED INDEX idx_audit_log_table_record 
ON audit_log(table_name, record_id, changed_at DESC);

CREATE NONCLUSTERED INDEX idx_audit_log_user 
ON audit_log(changed_by, changed_at DESC);

-- ============================================
-- 2. AUDIT TRIGGERS FOR CRITICAL TABLES
-- ============================================

-- Patients Audit Trigger
CREATE OR ALTER TRIGGER trg_audit_patients
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

-- Appointments Audit Trigger
CREATE OR ALTER TRIGGER trg_audit_appointments
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

-- ============================================
-- 3. QUERY AUDIT HISTORY
-- ============================================

-- View audit history for a specific patient
CREATE OR ALTER PROCEDURE sp_GetPatientAuditHistory
    @PatientId INT,
    @StartDate DATETIME2 = NULL,
    @EndDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        audit_id,
        table_name,
        CASE operation_type
            WHEN 'I' THEN 'Insert'
            WHEN 'U' THEN 'Update'
            WHEN 'D' THEN 'Delete'
        END AS operation,
        old_value,
        new_value,
        changed_by,
        changed_at
    FROM audit_log
    WHERE table_name = 'patients'
    AND record_id = @PatientId
    AND (@StartDate IS NULL OR changed_at >= @StartDate)
    AND (@EndDate IS NULL OR changed_at <= @EndDate)
    ORDER BY changed_at DESC;
END;
GO

PRINT 'Audit system created successfully!';
```

---

## 5. FULL-TEXT SEARCH

### File: `Data/fulltext_search.sql`

```sql
-- ======================================================
-- FULL-TEXT SEARCH CONFIGURATION
-- Fast search for patient and doctor names
-- ======================================================

USE ClinicDB;
GO

-- ============================================
-- 1. CREATE FULL-TEXT CATALOG
-- ============================================

CREATE FULLTEXT CATALOG ft_ClinicDB AS DEFAULT;
GO

-- ============================================
-- 2. CREATE FULL-TEXT INDEXES
-- ============================================

-- Full-text index on patients table
CREATE FULLTEXT INDEX ON patients(fullname, address, notes)
KEY INDEX PK__patients__4D5CE47641BCE2E1; -- Use your primary key name
GO

-- Full-text index on employees table
CREATE FULLTEXT INDEX ON employees(fullname, email)
KEY INDEX PK__employee__1299A8613C81F78F;
GO

-- ============================================
-- 3. SEARCH PROCEDURES
-- ============================================

-- Search patients by name or address
CREATE OR ALTER PROCEDURE sp_SearchPatients
    @SearchText NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        p.patient_id,
        p.fullname,
        p.date_of_birth,
        p.gender,
        p.phone,
        p.email,
        p.address,
        RANK() OVER (ORDER BY FT_TBL.RANK DESC) AS search_rank
    FROM patients p
    INNER JOIN CONTAINSTABLE(patients, (fullname, address), @SearchText) AS FT_TBL
        ON p.patient_id = FT_TBL.[KEY]
    ORDER BY FT_TBL.RANK DESC;
END;
GO

-- Search doctors by name or specialty
CREATE OR ALTER PROCEDURE sp_SearchDoctors
    @SearchText NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        e.emp_id AS doctor_id,
        e.fullname,
        e.email,
        e.phone,
        sp.name AS specialty_name,
        FT_TBL.RANK AS search_rank
    FROM employees e
    INNER JOIN CONTAINSTABLE(employees, fullname, @SearchText) AS FT_TBL
        ON e.emp_id = FT_TBL.[KEY]
    JOIN doctors d ON e.emp_id = d.doctor_id
    LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
    LEFT JOIN specialties sp ON ds.specialty_id = sp.specialty_id
    WHERE e.employee_type = 'D'
    ORDER BY FT_TBL.RANK DESC;
END;
GO

PRINT 'Full-text search configured successfully!';
```

---

**Tổng kết:** File này cung cấp implementations chi tiết cho các tính năng CSDL nâng cao. Copy & paste trực tiếp vào SQL Server để chạy.

**Các file tiếp theo sẽ cover:**
- Testing implementations
- Performance monitoring
- Security hardening
- Docker & CI/CD

**Sử dụng như sau:**
```sql
-- Chạy tuần tự:
1. create_indexes.sql      -- Tối ưu performance
2. advanced_procedures.sql  -- Business logic
3. create_views.sql         -- Reporting views
4. audit_system.sql         -- Audit trail
5. fulltext_search.sql      -- Search features
```
